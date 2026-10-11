// Déconnexion : route sans affichage. On révoque la session côté API, puis on
// détruit le cookie. En POST seulement (formulaire de l'en-tête), pour qu'un
// simple lien ou une image piégée ne puisse pas déconnecter quelqu'un.
import { redirect } from 'react-router';
import { api } from '../api.js';
import { destroySession, getSession } from '../session.js';

export async function action({ request }) {
  // La session du client est lue pour récupérer le token à révoquer auprès de l'API.
  const session = await getSession(request);
  const token = session.get('token');
  // Sans token, il reste utile de détruire le cookie local pour repartir proprement.
  if (token) await api('/api/auth/logout', { token, method: 'POST' });
  // La réponse Set-Cookie supprime le cookie après la révocation côté API.
  return redirect('/', { headers: { 'Set-Cookie': await destroySession(session) } });
}

export function loader() {
  // La déconnexion est une écriture: un GET direct ne doit rien modifier.
  return redirect('/');
}
