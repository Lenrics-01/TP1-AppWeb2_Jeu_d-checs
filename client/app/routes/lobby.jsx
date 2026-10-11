// Salon d'attente : affiche le code à transmettre et attend l'adversaire.
// Toutes les 1,5 s, on relance le loader (useRevalidator) ; dès que la partie
// est active, le loader redirige vers la partie.
// Ces hooks gèrent le polling, la référence stable et l'état du bouton copier.
import { useEffect, useRef, useState } from 'react';
// useRevalidator relance le loader sans changer l'URL.
import { Link, data, redirect, useRevalidator } from 'react-router';
// Les loaders appellent l'API côté serveur et gèrent les sessions expirées.
import { apiOrLogin } from '../api.js';
import { requireToken } from '../session.js';

export function meta({ params }) {
  // Le code est inclus dans le titre pour identifier le salon ouvert.
  return [{ title: `Partie ${params.code} — en attente` }];
}

export async function loader({ request, params }) {
  // Le créateur doit être authentifié pour consulter son salon.
  const token = await requireToken(request);
  const res = await apiOrLogin(`/api/games/${params.code}`, { token });
  if (!res.ok) throw data(res.data?.error ?? 'Partie introuvable.', { status: res.status });
  // Dès qu'un adversaire rejoint, le prochain polling redirige vers le plateau.
  if (res.data.status !== 'waiting') throw redirect(`/games/${res.data.code}`);
  return { code: res.data.code };
}

// Récit 2 : la page qui affiche le code à transmettre à l'adversaire.
export default function Lobby({ loaderData }) {
  // Le code est fourni par le loader, donc présent dès le rendu serveur.
  const { code } = loaderData;
  // useRevalidator permet de relancer le loader de la page à la demande.
  const revalidator = useRevalidator();
  // État local : true après un clic sur « Copier le code », pour afficher « Copié ! ».
  const [copied, setCopied] = useState(false);

  // Un ref pour que l'intervalle soit créé une seule fois, tout en voyant
  // toujours la dernière version de revalidator.
  const revalidatorRef = useRef(revalidator);
  revalidatorRef.current = revalidator;

  // [] : l'effet ne s'exécute qu'une fois, à l'affichage de la page.
  // La fonction renvoyée arrête l'intervalle quand on quitte la page.
  useEffect(() => {
    const id = setInterval(() => {
      const r = revalidatorRef.current;
      // Pas de nouvelle requête si la précédente n'est pas finie ou si l'onglet est caché.
      if (r.state === 'idle' && document.visibilityState === 'visible') r.revalidate();
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // Copie le code dans le presse-papiers (API du navigateur), puis affiche « Copié ! ».
  async function copy() {
    // L'API Clipboard appartient au navigateur; aucune donnée sensible n'est copiée.
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }

  return (
    <section className="card narrow center">
      <h1>Partie créée</h1>
      <p>Donnez ce code à votre adversaire :</p>
      <p className="invite-code">{code}</p>
      <button type="button" onClick={copy}>
        {copied ? 'Copié !' : 'Copier le code'}
      </button>
      <p className="muted waiting">En attente de l’adversaire…</p>
      <p className="muted small">Le code ne peut servir qu’une seule fois.</p>
      <Link to="/">Retour à l’accueil</Link>
    </section>
  );
}
