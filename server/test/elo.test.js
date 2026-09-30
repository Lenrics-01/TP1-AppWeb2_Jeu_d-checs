// Tests unitaires du calcul Elo : fonctions pures, pas besoin de serveur.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { expectedScore, newElo, updateRatings } from '../src/elo.js';

describe('expectedScore', () => {
  it('vaut 0,5 entre deux joueurs de même force', () => {
    assert.equal(expectedScore(1000, 1000), 0.5);
  });

  it('favorise le joueur le mieux classé', () => {
    assert.ok(Math.abs(expectedScore(1200, 1000) - 0.7597) < 0.0001);
    assert.ok(Math.abs(expectedScore(1000, 1200) - 0.2403) < 0.0001);
  });
});

describe('newElo', () => {
  it('donne +10 / -10 / 0 entre deux joueurs à 1000', () => {
    assert.equal(newElo(1000, 1000, 1), 1010);
    assert.equal(newElo(1000, 1000, 0), 990);
    assert.equal(newElo(1000, 1000, 0.5), 1000);
  });

  it("arrondit à l'entier le plus proche", () => {
    // 1200 + 20 * (0,5 - 0,7597) = 1194,8 -> 1195
    assert.equal(newElo(1200, 1000, 0.5), 1195);
    // 1000 + 20 * (0,5 - 0,2403) = 1005,2 -> 1005
    assert.equal(newElo(1000, 1200, 0.5), 1005);
  });

  it('ne dépasse jamais 3000', () => {
    assert.equal(newElo(3000, 1000, 1), 3000);
    assert.equal(newElo(2995, 2995, 1), 3000);
  });

  it('ne descend jamais sous 100', () => {
    assert.equal(newElo(100, 3000, 0), 100);
    assert.equal(newElo(105, 105, 0), 100);
  });
});

describe('updateRatings', () => {
  it('met à jour les deux joueurs à partir des Elo d’avant la partie', () => {
    assert.deepEqual(updateRatings(1000, 1000, 'white'), { white: 1010, black: 990 });
    assert.deepEqual(updateRatings(1000, 1000, 'black'), { white: 990, black: 1010 });
    assert.deepEqual(updateRatings(1200, 1000, 'draw'), { white: 1195, black: 1005 });
  });
});
