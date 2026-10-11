// Calcul du classement Elo, tel que défini dans l'énoncé.
// Fonctions pures (aucun accès à la base) : faciles à tester unitairement.

// Elo attribué à un nouveau joueur.
export const INITIAL_ELO = 1000;
// Coefficient qui contrôle l'ampleur d'une variation après une partie.
export const K = 20;
// Bornes empêchant un classement absurde ou négatif.
export const MIN_ELO = 100;
export const MAX_ELO = 3000;

/** attendu(A) = 1 / (1 + 10 ** ((eloB - eloA) / 400)) : probabilité que A gagne. */
export function expectedScore(eloA, eloB) {
  // Plus A est fort par rapport à B, plus cette probabilité se rapproche de 1.
  return 1 / (1 + 10 ** ((eloB - eloA) / 400));
}

/**
 * nouvelElo(A) = eloA + 20 * (score(A) - attendu(A)),
 * arrondi à l'entier le plus proche puis ramené dans [100, 3000].
 * score vaut 1 (victoire), 0.5 (nulle) ou 0 (défaite).
 */
export function newElo(eloA, eloB, score) {
  // L'écart entre score réel et score attendu détermine le gain ou la perte.
  const raw = eloA + K * (score - expectedScore(eloA, eloB));
  // Math.round produit un classement entier, puis les bornes sont appliquées.
  return Math.min(MAX_ELO, Math.max(MIN_ELO, Math.round(raw)));
}

/**
 * Nouveaux classements des deux joueurs d'une partie.
 * result : 'white', 'black' ou 'draw'. Les deux calculs partent des Elo d'avant
 * la partie (on ne réutilise pas le nouvel Elo de blanc pour calculer celui de noir).
 */
export function updateRatings(whiteElo, blackElo, result) {
  // On encode le résultat du point de vue des blancs: victoire, défaite ou nulle.
  const whiteScore = result === 'white' ? 1 : result === 'black' ? 0 : 0.5;
  // Le score noir est le complément du score blanc.
  return {
    white: newElo(whiteElo, blackElo, whiteScore),
    black: newElo(blackElo, whiteElo, 1 - whiteScore),
  };
}
