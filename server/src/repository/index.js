import { createAccountsRepository } from './accounts.js';
import { createGamesRepository } from './games.js';

export { openDatabase, seedDatabase } from './db.js';

/**
 * Point d'entrée unique vers la base : le reste du code ne voit jamais de SQL,
 * seulement des fonctions comme repo.games.find(code).
 */
export function createRepository(db) {
  // Cette façade sépare les routes HTTP du SQL : app.js utilise des méthodes
  // métier comme games.find() plutôt que de connaître les tables directement.
  return {
    accounts: createAccountsRepository(db),
    games: createGamesRepository(db),

    /**
     * Exécute fn dans une transaction : soit tout est écrit, soit rien.
     * Ex. : un coup qui donne mat enregistre le coup, la fin de partie et les deux
     * nouveaux Elo ensemble ; une erreur au milieu annule tout.
     */
    transaction(fn) {
      // Un coup pouvant aussi terminer la partie et modifier les Elo, ces
      // écritures doivent réussir ensemble ou être toutes annulées.
      db.exec('BEGIN');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    close() {
      db.close();
    },
  };
}
