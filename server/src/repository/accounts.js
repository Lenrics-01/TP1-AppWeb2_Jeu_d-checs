import crypto from 'node:crypto';

// Colonnes renvoyées pour un joueur : jamais le github_id, qui ne sert qu'à l'identifier.
const PLAYER_COLUMNS = 'id, name, elo';

/** Tout le SQL qui concerne les joueurs et leurs sessions. */
export function createAccountsRepository(db) {
  // Les requêtes préparées sont créées une fois puis réutilisées. Les valeurs
  // utilisateur restent des paramètres SQL et ne sont jamais concaténées au texte.
  const selectByGithubId = db.prepare(`SELECT ${PLAYER_COLUMNS} FROM players WHERE github_id = ?`);
  const selectById = db.prepare(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = ?`);
  // Pas de valeur pour elo : la valeur par défaut du schéma (1000) s'applique.
  const insertPlayer = db.prepare('INSERT INTO players (github_id, name) VALUES (?, ?)');
  const updateName = db.prepare('UPDATE players SET name = ? WHERE id = ?');
  const updateElo = db.prepare('UPDATE players SET elo = ? WHERE id = ?');

  const insertSession = db.prepare('INSERT INTO sessions (token, player_id) VALUES (?, ?)');
  const selectBySession = db.prepare(
    `SELECT p.id, p.name, p.elo FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token = ?`,
  );
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');

  const selectLeaderboard = db.prepare(
    `SELECT ${PLAYER_COLUMNS} FROM players ORDER BY elo DESC, name ASC LIMIT ?`,
  );

  return {
    /**
     * Retrouve le joueur associé à un compte GitHub, ou l'inscrit (Elo 1000)
     * si c'est sa première connexion. Le nom est mis à jour s'il a changé.
     */
    upsertFromGithub({ githubId, name }) {
      // Un compte GitHub doit retrouver le même joueur à chaque connexion,
      // même si son nom affiché a changé depuis la dernière visite.
      const existing = selectByGithubId.get(githubId);
      if (existing) {
        if (existing.name !== name) updateName.run(name, existing.id);
        return { ...existing, name };
      }
      const { lastInsertRowid } = insertPlayer.run(githubId, name);
      return selectById.get(lastInsertRowid);
    },

    findById(id) {
      return selectById.get(id);
    },

    setElo(playerId, elo) {
      updateElo.run(elo, playerId);
    },

    /** Crée une session et renvoie son jeton : 32 octets aléatoires, impossible à deviner. */
    createSession(playerId) {
      // Le jeton aléatoire identifie la session auprès de l'API. Le navigateur
      // ne le reçoit qu'à l'intérieur du cookie de session du client.
      const token = crypto.randomBytes(32).toString('base64url');
      insertSession.run(token, playerId);
      return token;
    },

    findPlayerBySession(token) {
      // Une session absente ou supprimée produit undefined; le middleware
      // d'authentification la traite alors comme une requête anonyme.
      return selectBySession.get(token);
    },

    deleteSession(token) {
      deleteSession.run(token);
    },

    leaderboard(limit = 10) {
      return selectLeaderboard.all(limit);
    },
  };
}
