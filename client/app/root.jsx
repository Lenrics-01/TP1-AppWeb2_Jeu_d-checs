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

export function Layout({ children }) {
  const rootData = useRouteLoaderData('root');
  const player = rootData?.player;

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="site-header">
          <Link to="/" className="brand">
            ♞ Échecs
          </Link>
          {player ? (
            <div className="whoami">
              <span>
                {player.name} <span className="elo">{player.elo}</span>
              </span>
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
        <main>{children}</main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function meta() {
  return [{ title: 'Échecs en ligne' }];
}

export function ErrorBoundary({ error }) {
  let title = 'Erreur';
  let message = 'Une erreur inattendue est survenue.';
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
