import crypto from 'node:crypto';

// Sans 0/O ni 1/I/L, pour qu'un code dicté ou recopié ne soit pas ambigu.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

// Une partie avec le nom et l'Elo actuel de ses deux joueurs.
const GAME_SELECT = `
  SELECT g.*,
         w.name AS white_name, w.elo AS white_elo,
         b.name AS black_name, b.elo AS black_elo
  FROM games g
  LEFT JOIN players w ON w.id = g.white_id
  LEFT JOIN players b ON b.id = g.black_id`;

/** Tout le SQL qui concerne les parties et leurs coups. */
export function createGamesRepository(db) {
  const insertGame = db.prepare('INSERT INTO games (code, creator_id, fen) VALUES (?, ?, ?)');
  const codeExists = db.prepare('SELECT 1 FROM games WHERE code = ?');
  const selectGame = db.prepare(`${GAME_SELECT} WHERE g.code = ?`);

  // "AND status = 'waiting'" : c'est ce qui rend le code utilisable une seule fois.
  // Si deux personnes rejoignent en même temps, une seule mise à jour touchera la ligne.
  const updateJoin = db.prepare(
    `UPDATE games SET white_id = ?, black_id = ?, status = 'active'
     WHERE code = ? AND status = 'waiting'`,
  );

  const selectMoves = db.prepare(
    `SELECT ply, san, from_square AS "from", to_square AS "to"
     FROM moves WHERE game_code = ? ORDER BY ply`,
  );
  const insertMove = db.prepare(
    'INSERT INTO moves (game_code, ply, san, from_square, to_square) VALUES (?, ?, ?, ?, ?)',
  );
  const updateFen = db.prepare(`UPDATE games SET fen = ? WHERE code = ? AND status = 'active'`);

  const updateFinish = db.prepare(
    `UPDATE games
     SET status = 'finished', result = ?, end_reason = ?,
         white_elo_before = ?, white_elo_after = ?,
         black_elo_before = ?, black_elo_after = ?,
         finished_at = datetime('now')
     WHERE code = ? AND status = 'active'`,
  );

  const selectHistory = db.prepare(
    `${GAME_SELECT}
     WHERE g.status = 'finished' AND (g.white_id = ? OR g.black_id = ?)
     ORDER BY g.finished_at DESC, g.rowid DESC
     LIMIT ?`,
  );

  return {
    /** Crée une partie en attente et renvoie son code (unique). */
    create(creatorId, fen) {
      let code;
      do {
        code = randomCode();
      } while (codeExists.get(code));
      insertGame.run(code, creatorId, fen);
      return code;
    },

    find(code) {
      return selectGame.get(code);
    },

    /** Renvoie true si la partie a bien été rejointe (le code était encore libre). */
    join(code, whiteId, blackId) {
      return updateJoin.run(whiteId, blackId, code).changes === 1;
    },

    listMoves(code) {
      return selectMoves.all(code);
    },

    /**
     * Enregistre un coup et la nouvelle position.
     * ply doit être le rang du nouveau coup : la clé primaire refuse un doublon.
     */
    addMove({ code, ply, san, from, to, fen }) {
      insertMove.run(code, ply, san, from, to);
      return updateFen.run(fen, code).changes === 1;
    },

    /** Termine la partie et note les classements avant/après. */
    finish({ code, result, reason, white, black }) {
      return (
        updateFinish.run(result, reason, white.before, white.after, black.before, black.after, code)
          .changes === 1
      );
    },

    /** Les parties terminées d'un joueur, la plus récente en premier. */
    history(playerId, limit = 20) {
      return selectHistory.all(playerId, playerId, limit);
    },
  };
}
