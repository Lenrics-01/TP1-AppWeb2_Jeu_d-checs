// Déconnexion : route sans affichage. On révoque la session côté API, puis on
// détruit le cookie. En POST seulement (formulaire de l'en-tête), pour qu'un
// simple lien ou une image piégée ne puisse pas déconnecter quelqu'un.
import { redirect } from 'react-router';
import { api } from '../api.js';
import { destroySession, getSession } from '../session.js';

export async function action({ request }) {
  const session = await getSession(request);
  const token = session.get('token');
  if (token) await api('/api/auth/logout', { token, method: 'POST' });
  return redirect('/', { headers: { 'Set-Cookie': await destroySession(session) } });
}

export function loader() {
  return redirect('/');
}
