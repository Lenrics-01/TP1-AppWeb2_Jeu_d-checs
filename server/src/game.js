// Tout ce qui touche aux règles des échecs passe par ce fichier.
// Les règles elles-mêmes sont déléguées à chess.js : on ne les réimplémente pas.
import { Chess } from 'chess.js';

export const START_FEN = new Chess().fen();

/**
 * Reconstruit la partie en rejouant ses coups depuis la position initiale.
 * On pourrait partir de la FEN seule, mais rejouer la liste des coups donne à
 * chess.js l'historique complet : il peut alors détecter la triple répétition.
 */
export function replay(sanMoves) {
  const chess = new Chess();
  for (const san of sanMoves) chess.move(san);
  return chess;
}

/** 'white' ou 'black' : le camp qui doit jouer. */
export function turnColor(chess) {
  return chess.turn() === 'w' ? 'white' : 'black';
}

/**
 * Tente de jouer un coup. Renvoie le coup joué ({ san, from, to, ... }) ou null
 * s'il est illégal (chess.js lève une exception dans ce cas).
 * Promotion : dame par défaut ; ignorée par chess.js si le coup n'en est pas une.
 */
export function tryMove(chess, { from, to, promotion = 'q' }) {
  try {
    return chess.move({ from, to, promotion });
  } catch {
    return null;
  }
}

/** Fin de partie après le dernier coup, ou null si la partie continue. */
export function outcome(chess) {
  if (chess.isCheckmate()) {
    // Le camp qui doit jouer est mat : c'est l'autre qui gagne.
    return { result: chess.turn() === 'w' ? 'black' : 'white', reason: 'checkmate' };
  }
  if (chess.isStalemate()) return { result: 'draw', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { result: 'draw', reason: 'insufficient_material' };
  if (chess.isThreefoldRepetition()) return { result: 'draw', reason: 'repetition' };
  if (chess.isDraw()) return { result: 'draw', reason: 'fifty_moves' };
  return null;
}

/** La couleur d'un joueur dans une partie, ou null s'il n'y joue pas. */
export function colorOf(game, playerId) {
  if (game.white_id === playerId) return 'white';
  if (game.black_id === playerId) return 'black';
  return null;
}

export function opponentOf(color) {
  return color === 'white' ? 'black' : 'white';
}
