import {
  Form,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  isRouteErrorResponse,
  useRouteLoaderData,
} from 'react-router';
import { api } from './api.js';
import { destroySession, getSession } from './session.js';
import './styles.css';

// Le loader de la racine s'exécute pour toutes les pages : il fournit le joueur
// connecté (nom et Elo) à l'en-tête et à toutes les routes (useRouteLoaderData('root')).
export async function loader({ request }) {
  const session = await getSession(request);
  const token = session.get('token');
  if (!token) return { player: null };

  const res = await api('/api/me', { token });
  if (res.status === 401) {
    // Jeton expiré ou révoqué : on vide le cookie.
    return data({ player: null }, { headers: { 'Set-Cookie': await destroySession(session) } });
  }
  return { player: res.ok ? res.data : null };
}

// Pas besoin de relire /api/me quand seule la partie est rafraîchie par le polling.
export function shouldRevalidate({ formMethod, currentUrl, nextUrl, defaultShouldRevalidate }) {
  if (formMethod || currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate;
  return false;
}

// Layout : le squelette HTML commun à toutes les pages (en-tête + page courante).
// Il est rendu d'abord sur le serveur, puis repris par React dans le navigateur.
export function Layout({ children }) {
  // Les données du loader de la racine (ci-dessus) : le joueur connecté, ou null.
  const rootData = useRouteLoaderData('root');
  // « ?. » : rootData peut manquer, par exemple sur une page d'erreur.
  const player = rootData?.player;

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* <Meta /> et <Links /> insèrent le <title> (fonctions meta) et les fichiers CSS. */}
        <Meta />
        <Links />
      </head>
      <body>
        <header className="site-header">
          <Link to="/" className="brand">
            ♞ Échecs
          </Link>
          {/* Rendu conditionnel : connecté → nom, Elo et déconnexion ; sinon → bouton de connexion. */}
          {player ? (
            <div className="whoami">
              <span>
                {player.name} <span className="elo">{player.elo}</span>
              </span>
              {/* Un formulaire POST et non un lien : voir routes/logout.jsx. */}
              <Form method="post" action="/logout">
                <button type="submit" className="link-button">
                  Se déconnecter
                </button>
              </Form>
            </div>
          ) : (
            <Link to="/login" className="button">
              Se connecter
            </Link>
          )}
        </header>
        {/* children : la page courante (App), ou ErrorBoundary s'il y a eu une erreur. */}
        <main>{children}</main>
        <ScrollRestoration />
        {/* <Scripts /> charge le JavaScript de React : la page HTML reçue du serveur
            devient interactive dans le navigateur (« hydratation »). */}
        <Scripts />
      </body>
    </html>
  );
}

// App : <Outlet /> affiche la page qui correspond à l'URL (voir routes.js).
export default function App() {
  return <Outlet />;
}

export function meta() {
  return [{ title: 'Échecs en ligne' }];
}

<<<<<<< HEAD
=======
// Icône de l'onglet (un cavalier), écrite directement dans la page. Sans elle, le
// navigateur demande /favicon.ico, qui n'existe pas : React Router répond 404 et
// écrit une erreur dans le journal à chaque visite.
export function links() {
  return [
    {
      rel: 'icon',
      href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>♞</text></svg>",
    },
  ];
}

>>>>>>> 95b90118d43c169c237c17ade2e64e24d85eb33c
// ErrorBoundary : affiché à la place de la page quand un loader lance une erreur,
// par exemple throw data('Partie introuvable.', { status: 404 }) dans game.jsx.
export function ErrorBoundary({ error }) {
  let title = 'Erreur';
  let message = 'Une erreur inattendue est survenue.';
  // Erreur « prévue » (lancée avec data(...)) : on affiche son statut et son message.
  // Sinon (bogue), on garde le message générique.
  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? 'Introuvable' : `Erreur ${error.status}`;
    message = typeof error.data === 'string' ? error.data : error.statusText || message;
  }
  return (
    <section className="card">
      <h1>{title}</h1>
      <p>{message}</p>
      <Link to="/">Retour à l’accueil</Link>
    </section>
  );
}
