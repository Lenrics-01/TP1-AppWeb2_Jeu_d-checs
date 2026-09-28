import { createAccountsRepository } from './accounts.js';
import { createGamesRepository } from './games.js';

export { openDatabase, seedDatabase } from './db.js';

/**
 * Point d'entrée unique vers la base : le reste du code ne voit jamais de SQL,
 * seulement des fonctions comme repo.games.find(code).
 */
export function createRepository(db) {
  return {
    accounts: createAccountsRepository(db),
    games: createGamesRepository(db),

    /**
     * Exécute fn dans une transaction : soit tout est écrit, soit rien.
     * Ex. : un coup qui donne mat enregistre le coup, la fin de partie et les deux
     * nouveaux Elo ensemble ; une erreur au milieu annule tout.
     */
    transaction(fn) {
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
