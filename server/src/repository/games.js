import { randomBytes, randomInt } from 'node:crypto';
import { db, withTransaction } from './db.js';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const GAME_RESULTS = new Set(['white_wins', 'black_wins', 'draw']);

function findGameRow(code) {
	return db.prepare('SELECT * FROM games WHERE code = ?').get(code);
}

function generateGameCode() {
	return randomBytes(4).toString('hex').toUpperCase();
}

/** Crée une partie privée en attente et retourne son code. */
export function createGame(hostPlayerId) {
	let code;
	do {
		code = generateGameCode();
	} while (findGameRow(code));

	db.prepare(`
		INSERT INTO games (code, player_white_id, fen, status)
		VALUES (?, ?, ?, 'waiting')
	`).run(code, hostPlayerId, INITIAL_FEN);

	return findGame(code);
}

/** Fait rejoindre le second joueur et attribue les couleurs au hasard. */
export function joinGame(code, joiningPlayerId) {
	return withTransaction(() => {
		const game = findGameRow(code);
		if (!game || game.status !== 'waiting' || game.player_white_id === null) {
			return null;
		}
		if (game.player_white_id === joiningPlayerId) {
			return null;
		}

		const hostIsWhite = randomInt(2) === 0;
		const whitePlayerId = hostIsWhite ? game.player_white_id : joiningPlayerId;
		const blackPlayerId = hostIsWhite ? joiningPlayerId : game.player_white_id;
		const result = db.prepare(`
			UPDATE games
			SET player_white_id = ?, player_black_id = ?, status = 'active'
			WHERE code = ? AND status = 'waiting' AND player_black_id IS NULL
		`).run(whitePlayerId, blackPlayerId, code);

		return result.changes === 1 ? findGame(code) : null;
	});
}

/** Retourne la partie, avec les coups dans l'ordre où ils ont été joués. */
export function findGame(code) {
	const game = findGameRow(code);
	if (!game) return null;

	const moves = db.prepare(`
		SELECT id, game_code, san_move, move_number, fen_after
		FROM moves
		WHERE game_code = ?
		ORDER BY move_number
	`).all(code);

	return { ...game, moves };
}

/** Retourne uniquement l'historique des coups d'une partie. */
export function findMoves(code) {
	return db.prepare(`
		SELECT id, game_code, san_move, move_number, fen_after
		FROM moves
		WHERE game_code = ?
		ORDER BY move_number
	`).all(code);
}

/** Persiste un coup et la nouvelle FEN ensemble. Les règles sont validées par chess.js en amont. */
export function recordMove(code, playerId, sanMove, fenAfter) {
	if (!sanMove || !fenAfter) throw new TypeError('Le coup et la FEN sont obligatoires.');

	return withTransaction(() => {
		const game = findGameRow(code);
		if (!game || game.status !== 'active') return null;

		const activeColor = game.fen.split(' ')[1];
		const expectedPlayerId = activeColor === 'w'
			? game.player_white_id
			: game.player_black_id;
		if (expectedPlayerId !== playerId) return null;

		const { nextMoveNumber } = db.prepare(`
			SELECT COALESCE(MAX(move_number), 0) + 1 AS nextMoveNumber
			FROM moves
			WHERE game_code = ?
		`).get(code);

		db.prepare(`
			INSERT INTO moves (game_code, san_move, move_number, fen_after)
			VALUES (?, ?, ?, ?)
		`).run(code, sanMove, nextMoveNumber, fenAfter);

		const update = db.prepare(`
			UPDATE games SET fen = ?
			WHERE code = ? AND status = 'active' AND fen = ?
		`).run(fenAfter, code, game.fen);

		if (update.changes !== 1) throw new Error('La position de la partie a changé.');
		return { moveNumber: nextMoveNumber, fen: fenAfter };
	});
}

/** Termine une partie par mat ou nulle. */
export function finishGame(code, result) {
	if (!GAME_RESULTS.has(result)) throw new TypeError('Résultat de partie invalide.');

	return db.prepare(`
		UPDATE games SET status = 'finished', result = ?
		WHERE code = ? AND status = 'active'
	`).run(result, code).changes === 1;
}

/** Termine la partie en donnant la victoire à l'adversaire du joueur qui abandonne. */
export function resignGame(code, resigningPlayerId) {
	return withTransaction(() => {
		const game = findGameRow(code);
		if (!game || game.status !== 'active') return false;

		let result;
		if (game.player_white_id === resigningPlayerId) result = 'black_wins';
		else if (game.player_black_id === resigningPlayerId) result = 'white_wins';
		else return false;

		return db.prepare(`
			UPDATE games SET status = 'finished', result = ?
			WHERE code = ? AND status = 'active'
		`).run(result, code).changes === 1;
	});
}
