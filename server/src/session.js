// Authentification des requêtes à l'API.
// Le client envoie "Authorization: Bearer <jeton>" ; le jeton a été créé à la
// connexion GitHub et est stocké dans la table sessions.

/** Middleware : place le joueur connecté dans req.player (ou null). */
export function loadPlayer(repo) {
  return (req, res, next) => {
    // Une requête anonyme continue son chemin avec req.player = null.
    const match = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
    // On conserve le token pour que la route logout puisse le supprimer.
    req.token = match ? match[1] : null;
    // La base traduit le token en joueur; un token invalide ne lève pas d'erreur.
    req.player = req.token ? (repo.accounts.findPlayerBySession(req.token) ?? null) : null;
    // Le middleware ne décide pas des droits: il enrichit seulement la requête.
    next();
  };
}

/** Middleware : refuse la requête (401) si personne n'est connecté. */
export function requireAuth(req, res, next) {
  // Cette barrière est placée devant les routes qui exigent une identité.
  if (!req.player) {
    return res.status(401).json({ error: 'Vous devez être connecté.' });
  }
  // Les routes suivantes peuvent utiliser req.player sans refaire la requête SQL.
  next();
}
