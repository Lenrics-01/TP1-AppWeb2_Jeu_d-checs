// Appels à l'API Express. N'est utilisé que dans les loaders et actions,
// donc exécuté côté serveur : le jeton ne quitte jamais le serveur du client.
import { redirect } from 'react-router';
import { apiUrl } from './api-url.js';

/**
 * Appelle l'API et renvoie { ok, status, data }. Ne lève pas d'erreur pour un
 * refus (400, 404, 409...) : c'est à la route de décider quoi afficher.
 */
export async function api(path, { token, method = 'GET', body } = {}) {
  // Les loaders et actions appellent cette fonction côté serveur du client.
  // Le navigateur ne voit donc jamais directement le jeton de l'API.
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl() + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Lire text avant JSON permet de gérer aussi une réponse vide, par exemple
  // le 204 renvoyé après une déconnexion.
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

/** Comme api(), mais renvoie vers /login si le jeton n'est plus valide (401). */
export async function apiOrLogin(path, options) {
  const res = await api(path, options);
  // Une session supprimée côté API doit aussi faire disparaître l'état de
  // navigation côté client; la route React Router s'occupe de la redirection.
  if (res.status === 401) throw redirect('/login');
  return res;
}
