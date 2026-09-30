// Session du client : un cookie signé qui contient le jeton de l'API.
// - httpOnly : le JavaScript du navigateur ne peut pas le lire (protège du vol par XSS).
// - signé avec SESSION_SECRET : impossible à modifier sans le secret.
// - sameSite 'lax' : n'est pas envoyé par les formulaires POST d'un autre site (CSRF).
import { createCookieSessionStorage, redirect } from 'react-router';

let storage;

function getStorage() {
  if (!storage) {
    const secret = process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET doit être défini en production.');
    }
    storage = createCookieSessionStorage({
      cookie: {
        name: 'echecs_session',
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secrets: [secret ?? 'secret-de-developpement-seulement'],
        // true si le site est servi en HTTPS ; false pour http://localhost.
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: 60 * 60 * 24 * 30, // 30 jours
      },
    });
  }
  return storage;
}

export function getSession(request) {
  return getStorage().getSession(request.headers.get('Cookie'));
}

export function commitSession(session) {
  return getStorage().commitSession(session);
}

export function destroySession(session) {
  return getStorage().destroySession(session);
}

export async function getToken(request) {
  const session = await getSession(request);
  return session.get('token') ?? null;
}

/** Le jeton de l'API, ou une redirection vers /login si personne n'est connecté. */
export async function requireToken(request) {
  const token = await getToken(request);
  if (!token) throw redirect('/login');
  return token;
}
