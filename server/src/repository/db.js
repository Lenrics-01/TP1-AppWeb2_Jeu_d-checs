import { DatabaseSync } from 'node:sqlite';
import { Chess } from 'chess.js';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = new URL('../../data/', import.meta.url);
const dbPath = process.env.DB_PATH ?? fileURLToPath(new URL('chess.db', dataDir));

mkdirSync(dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);

// Les lecteurs (le harnais, un autre processus) ne bloquent pas le serveur.
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/** Crée les tables (schema.sql), puis les remplit (seed.sql) si la base est vide. */
export function initializeDatabase() {
  const schema = readFileSync(fileURLToPath(new URL('schema.sql', dataDir)), 'utf8');
  db.exec(schema);

  const moveColumns = db.prepare('PRAGMA table_info(moves)').all();
  if (!moveColumns.some(column => column.name === 'fen_after')) {
    db.exec('ALTER TABLE moves ADD COLUMN fen_after TEXT');
  }

  const gamesToMigrate = db.prepare(`
    SELECT DISTINCT game_code
    FROM moves
    WHERE fen_after IS NULL
  `).all();
  if (gamesToMigrate.length > 0) {
    withTransaction(() => {
      const updateMove = db.prepare('UPDATE moves SET fen_after = ? WHERE id = ?');
      for (const { game_code: gameCode } of gamesToMigrate) {
        const chess = new Chess();
        const moves = db.prepare(`
          SELECT id, san_move
          FROM moves
          WHERE game_code = ?
          ORDER BY move_number
        `).all(gameCode);
        for (const move of moves) {
          chess.move(move.san_move);
          updateMove.run(chess.fen(), move.id);
        }
      }
    });
  }

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM games').get();
  if (n === 0) {
    const seed = readFileSync(fileURLToPath(new URL('seed.sql', dataDir)), 'utf8');
    db.exec(seed);
  }
}

/**
 * Enveloppe des écritures qui doivent réussir ENSEMBLE. Si fn lève une
 * erreur, tout est annulé (ROLLBACK) ; sinon tout est confirmé (COMMIT).
 */
export function withTransaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

