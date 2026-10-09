// Connexion avec GitHub (OAuth), étapes côté client :
//  /login                     -> page avec le bouton « Se connecter avec GitHub »
//  /login?start=github        -> redirection vers GitHub, avec un "state" aléatoire
//  /login?code=...&state=...  -> retour de GitHub : on vérifie le state, on envoie
//                                le code à l'API, on garde le jeton reçu dans le cookie.
import { Form, Link, redirect } from 'react-router';
import { api } from '../api.js';
import { commitSession, getSession } from '../session.js';

export function meta() {
  return [{ title: 'Connexion — Échecs en ligne' }];
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const session = await getSession(request);
  // Doit correspondre à l'« Authorization callback URL » de l'application GitHub.
  const redirectUri = `${url.origin}/login`;
  const devLogin = process.env.DEV_LOGIN === 'true';

  if (url.searchParams.get('start') === 'github') {
    // Le state protège contre une attaque CSRF sur la connexion : on ne
    // l'accepte au retour que s'il correspond à celui gardé dans notre cookie.
    // crypto.randomUUID() : Web Crypto, disponible globalement dans Node.
    const state = crypto.randomUUID();
    session.set('oauthState', state);
    const github = new URL('https://github.com/login/oauth/authorize');
    github.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID ?? '');
    github.searchParams.set('redirect_uri', redirectUri);
    github.searchParams.set('state', state);
    throw redirect(github.toString(), { headers: { 'Set-Cookie': await commitSession(session) } });
  }

  const code = url.searchParams.get('code');
  if (code) {
    const expectedState = session.get('oauthState');
    session.unset('oauthState');
    if (!expectedState || url.searchParams.get('state') !== expectedState) {
      return { devLogin, error: 'La connexion a expiré. Veuillez réessayer.' };
    }
    const res = await api('/api/auth/github', { method: 'POST', body: { code, redirectUri } });
    if (!res.ok) return { devLogin, error: res.data?.error ?? 'Connexion refusée.' };
    session.set('token', res.data.token);
    throw redirect('/', { headers: { 'Set-Cookie': await commitSession(session) } });
  }

  if (url.searchParams.get('error')) {
    return { devLogin, error: 'La connexion GitHub a été annulée.' };
  }
  return { devLogin, error: null };
}

// Connexion de développement (sans GitHub), seulement si DEV_LOGIN=true.
export async function action({ request }) {
  if (process.env.DEV_LOGIN !== 'true') throw new Response('Introuvable', { status: 404 });
  const form = await request.formData();
  const res = await api('/api/auth/dev', { method: 'POST', body: { name: form.get('name') } });
  if (!res.ok) return { error: res.data?.error ?? 'Connexion refusée.' };
  const session = await getSession(request);
  session.set('token', res.data.token);
  return redirect('/', { headers: { 'Set-Cookie': await commitSession(session) } });
}

// La page de connexion. Deux sources d'erreur possibles : l'action (connexion de
// développement refusée) ou le loader (retour de GitHub en échec).
export default function Login({ loaderData, actionData }) {
  const error = actionData?.error ?? loaderData.error;
  return (
    <section className="card narrow">
      <h1>Connexion</h1>
      <p>Votre compte GitHub vous donne un nom et un classement Elo (1000 au départ).</p>
      {/* reloadDocument : on quitte le site pour aller sur GitHub, pas de navigation client. */}
      <Link to="/login?start=github" reloadDocument className="button">
        Se connecter avec GitHub
      </Link>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* Affiché seulement si DEV_LOGIN=true (jamais en production). <Form> envoie
          le nom à l'action de cette page, qui demande un jeton à l'API. */}
      {loaderData.devLogin && (
        <Form method="post" className="dev-login">
          <h2>Connexion de développement</h2>
          <p className="muted">DEV_LOGIN=true : pour tester à deux joueurs sur un seul poste.</p>
          <div className="row">
            <input name="name" placeholder="Nom du joueur" required />
            <button type="submit">Entrer</button>
          </div>
        </Form>
      )}
    </section>
  );
}
