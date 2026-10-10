// Page d'accueil — rendue côté serveur : le classement et l'historique arrivent
// déjà dans le HTML, sans écran de chargement.
import { Form, Link, redirect, useActionData, useNavigation, useRouteLoaderData } from 'react-router';
import { api, apiOrLogin } from '../api.js';
import { getToken, requireToken } from '../session.js';
import Leaderboard from '../components/Leaderboard.jsx';

export function meta() {
  return [{ title: 'Accueil — Échecs en ligne' }];
}

export async function loader({ request }) {
  const token = await getToken(request);
  const [leaderboard, history] = await Promise.all([
    api('/api/leaderboard'),
    token ? api('/api/me/games', { token }) : null,
  ]);
  return {
    leaderboard: leaderboard.ok ? leaderboard.data : [],
    history: history?.ok ? history.data : [],
  };
}

// Les deux formulaires de la page : créer une partie ou en rejoindre une.
export async function action({ request }) {
  const token = await requireToken(request);
  const form = await request.formData();

  if (form.get('intent') === 'create') {
    // Récit 2 : on reçoit un code, puis on attend l'adversaire dans le salon.
    const res = await apiOrLogin('/api/games', { token, method: 'POST' });
    if (!res.ok) return { error: res.data?.error ?? 'Création impossible.' };
    return redirect(`/lobby/${res.data.code}`);
  }

  if (form.get('intent') === 'join') {
    // Récit 3 : un code inconnu ou déjà utilisé est refusé avec le message de l'API.
    const code = String(form.get('code') ?? '').trim().toUpperCase();
    const res = await apiOrLogin('/api/games/join', { token, method: 'POST', body: { code } });
    if (!res.ok) return { error: res.data?.error ?? 'Impossible de rejoindre.', code };
    return redirect(`/games/${res.data.code}`);
  }

  return { error: 'Action inconnue.' };
}

const OUTCOME_LABELS = { win: 'Victoire', loss: 'Défaite', draw: 'Nulle' };
const REASON_LABELS = {
  checkmate: 'mat',
  stalemate: 'pat',
  resignation: 'abandon',
  repetition: 'répétition',
  insufficient_material: 'matériel insuffisant',
  fifty_moves: '50 coups',
};

export default function Home({ loaderData }) {
  // Le joueur connecté vient du loader de la racine (root.jsx), partagé par toutes les pages.
  const { player } = useRouteLoaderData('root');
  // Le classement et l'historique viennent du loader de cette page, reçus en props.
  const { leaderboard, history } = loaderData;
  // La réponse de l'action après l'envoi d'un formulaire, par exemple
  // { error: 'Ce code a déjà été utilisé.', code: 'ABC234' }. undefined avant tout envoi.
  const actionData = useActionData();
  // Pendant l'envoi d'un formulaire, on désactive les boutons (évite un double clic).
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';

  // Visiteur non connecté : présentation et classement seulement.
  if (!player) {
    return (
      <div className="grid">
        <section className="card hero">
          <h1>Jouez aux échecs contre qui vous voulez</h1>
          <p>
            Connectez-vous avec GitHub, créez une partie privée et envoyez le code à votre
            adversaire. Chaque partie compte pour votre classement Elo.
          </p>
          <Link to="/login" className="button">
            Se connecter avec GitHub
          </Link>
        </section>
        <Leaderboard players={leaderboard} />
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <h1>Bonjour {player.name}</h1>
        <p>
          Votre classement : <strong className="elo big">{player.elo}</strong>
        </p>

        {/* <Form> de React Router : envoie le formulaire à l'action de cette page.
            Le name/value du bouton (intent) indique à l'action lequel des deux formulaires a été envoyé. */}
        <Form method="post">
          <button type="submit" name="intent" value="create" disabled={busy}>
            Créer une partie privée
          </button>
        </Form>

        {/* Récit 3 : rejoindre avec un code. */}
        <Form method="post" className="join-form">
          <label htmlFor="code">Rejoindre avec un code</label>
          <div className="row">
            {/* defaultValue : après un refus, le code tapé reste dans le champ. */}
            <input
              id="code"
              name="code"
              placeholder="ABC234"
              maxLength={6}
              autoComplete="off"
              defaultValue={actionData?.code ?? ''}
              required
            />
            <button type="submit" name="intent" value="join" disabled={busy}>
              Rejoindre
            </button>
          </div>
        </Form>
        {/* Le message de refus de l'API (code inconnu, déjà utilisé, contre soi-même).
            role="alert" : il est lu à voix haute par les lecteurs d'écran. */}
        {actionData?.error && (
          <p className="error" role="alert">
            {actionData.error}
          </p>
        )}
      </section>

      {/* currentId : pour surligner le joueur connecté dans le classement. */}
      <Leaderboard players={leaderboard} currentId={player.id} />

      {/* Récit 6 : l'historique des parties terminées, la plus récente en premier. */}
      <section className="card wide">
        <h2>Historique des parties</h2>
        {history.length === 0 ? (
          <p className="muted">Aucune partie terminée pour l’instant.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Adversaire</th>
                <th>Couleur</th>
                <th>Résultat</th>
                <th>Elo</th>
              </tr>
            </thead>
            <tbody>
              {/* Une ligne par partie. key={g.code} : identifiant unique, pour que React
                  sache quelle ligne a changé. */}
              {history.map((g) => (
                <tr key={g.code}>
                  <td>
                    <Link to={`/games/${g.code}`}>{g.opponent}</Link>
                  </td>
                  <td>{g.color === 'white' ? 'Blancs' : 'Noirs'}</td>
                  <td className={g.outcome}>
                    {OUTCOME_LABELS[g.outcome]} ({REASON_LABELS[g.reason] ?? g.reason})
                  </td>
                  <td>
                    {g.eloBefore} → {g.eloAfter} <EloDelta before={g.eloBefore} after={g.eloAfter} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// L'écart d'Elo entre avant et après la partie : (+10) en vert, (-10) en rouge, (±0) sinon.
// Les couleurs viennent des classes CSS « up » et « down » (styles.css).
function EloDelta({ before, after }) {
  const delta = after - before;
  if (delta === 0) return <span className="delta">(±0)</span>;
  return <span className={`delta ${delta > 0 ? 'up' : 'down'}`}>({delta > 0 ? `+${delta}` : delta})</span>;
}
