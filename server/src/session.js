// Authentification des requêtes à l'API.
// Le client envoie "Authorization: Bearer <jeton>" ; le jeton a été créé à la
// connexion GitHub et est stocké dans la table sessions.

/** Middleware : place le joueur connecté dans req.player (ou null). */
export function loadPlayer(repo) {
  return (req, res, next) => {
    const match = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
    req.token = match ? match[1] : null;
    req.player = req.token ? (repo.accounts.findPlayerBySession(req.token) ?? null) : null;
    next();
  };
}

/** Middleware : refuse la requête (401) si personne n'est connecté. */
export function requireAuth(req, res, next) {
  if (!req.player) {
    return res.status(401).json({ error: 'Vous devez être connecté.' });
  }
  next();
}
