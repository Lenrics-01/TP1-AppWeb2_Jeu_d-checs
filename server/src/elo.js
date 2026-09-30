// Calcul du classement Elo, tel que défini dans l'énoncé.
// Fonctions pures (aucun accès à la base) : faciles à tester unitairement.

export const INITIAL_ELO = 1000;
export const K = 20;
export const MIN_ELO = 100;
export const MAX_ELO = 3000;

/** attendu(A) = 1 / (1 + 10 ** ((eloB - eloA) / 400)) : probabilité que A gagne. */
export function expectedScore(eloA, eloB) {
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}

/**
 * nouvelElo(A) = eloA + 20 * (score(A) - attendu(A)),
 * arrondi à l'entier le plus proche puis ramené dans [100, 3000].
 * score vaut 1 (victoire), 0.5 (nulle) ou 0 (défaite).
 */
export function newElo(eloA, eloB, score) {
  const raw = eloA + K * (score - expectedScore(eloA, eloB));
  return Math.min(MAX_ELO, Math.max(MIN_ELO, Math.round(raw)));
}

/**
 * Nouveaux classements des deux joueurs d'une partie.
 * result : 'white', 'black' ou 'draw'. Les deux calculs partent des Elo d'avant
 * la partie (on ne réutilise pas le nouvel Elo de blanc pour calculer celui de noir).
 */
export function updateRatings(whiteElo, blackElo, result) {
  const whiteScore = result === 'white' ? 1 : result === 'black' ? 0 : 0.5;
  return {
    white: newElo(whiteElo, blackElo, whiteScore),
    black: newElo(blackElo, whiteElo, 1 - whiteScore),
  };
}
