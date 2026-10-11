// Tests d'intégration de l'API : de vraies requêtes HTTP vers Express,
// une vraie base SQLite (en mémoire). Un bloc describe par récit.
// Les hooks du test runner créent et ferment une API autour de chaque cas.
import { describe, it, beforeEach, afterEach } from 'node:test';
// assert vérifie les statuts HTTP et les objets JSON retournés.
import assert from 'node:assert/strict';
// fs, os et path servent uniquement au test de persistance sur fichier.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Le helper fournit login, request et les parcours de jeu réutilisables.
import { startTestServer } from './helpers.js';

let api;
beforeEach(async () => {
  // Chaque test démarre avec une base mémoire neuve.
  api = await startTestServer();
});
afterEach(async () => {
  // La fermeture évite de laisser un port ou une connexion SQLite ouverte.
  await api.close();
});

describe('Récit 1 : connexion', () => {
  // Ces tests couvrent l'authentification, la création du joueur et la révocation.
  it('refuse les routes protégées sans jeton', async () => {
    const res = await api.request('GET', '/api/me');
    assert.equal(res.status, 401);
  });

  it('inscrit un nouveau joueur avec un Elo de 1000', async () => {
    const { token, player } = await api.login('alice');
    assert.equal(player.name, 'alice');
    assert.equal(player.elo, 1000);
    const me = await api.request('GET', '/api/me', { token });
    assert.deepEqual(me.body, player);
  });

  it('retrouve le même joueur à la connexion suivante', async () => {
    const first = await api.login('alice');
    const second = await api.login('alice');
    assert.equal(second.player.id, first.player.id);
    assert.notEqual(second.token, first.token);
  });

  it('refuse un code GitHub invalide', async () => {
    const res = await api.request('POST', '/api/auth/github', { body: { code: 'faux' } });
    assert.equal(res.status, 401);
  });

  it('invalide le jeton à la déconnexion', async () => {
    const { token } = await api.login('alice');
    assert.equal((await api.request('POST', '/api/auth/logout', { token })).status, 204);
    assert.equal((await api.request('GET', '/api/me', { token })).status, 401);
  });
});

describe('Récit 2 : créer une partie privée', () => {
  // Le créateur reçoit un code et la partie reste en attente.
  it('renvoie un code de 6 caractères et une partie en attente', async () => {
    const { token } = await api.login('alice');
    const res = await api.request('POST', '/api/games', { token });
    assert.equal(res.status, 201);
    assert.match(res.body.code, /^[A-Z0-9]{6}$/);

    const game = await api.request('GET', `/api/games/${res.body.code}`, { token });
    assert.equal(game.body.status, 'waiting');
  });

  it('exige d’être connecté', async () => {
    const res = await api.request('POST', '/api/games');
    assert.equal(res.status, 401);
  });
});

describe('Récit 3 : rejoindre avec un code', () => {
  // Ces cas couvrent la normalisation, les collisions et l'attribution des couleurs.
  it('démarre la partie et attribue une couleur à chacun', async () => {
    const alice = await api.login('alice');
    const bob = await api.login('bob');
    const { body } = await api.request('POST', '/api/games', { token: alice.token });

    const res = await api.request('POST', '/api/games/join', {
      token: bob.token,
      body: { code: body.code.toLowerCase() }, // la casse ne compte pas
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'active');
    const ids = [res.body.white.id, res.body.black.id].sort();
    assert.deepEqual(ids, [alice.player.id, bob.player.id].sort());
  });

  it('refuse un code inconnu avec un message clair', async () => {
    const { token } = await api.login('bob');
    const res = await api.request('POST', '/api/games/join', { token, body: { code: 'ZZZZZZ' } });
    assert.equal(res.status, 404);
    assert.match(res.body.error, /aucune partie/);
  });

  it('refuse un code déjà utilisé', async () => {
    const game = await api.startGame('alice', 'bob');
    const carol = await api.login('carol');
    const res = await api.request('POST', '/api/games/join', {
      token: carol.token,
      body: { code: game.code },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /déjà été utilisé/);
  });

  it('empêche de jouer contre soi-même', async () => {
    const { token } = await api.login('alice');
    const { body } = await api.request('POST', '/api/games', { token });
    const res = await api.request('POST', '/api/games/join', { token, body: { code: body.code } });
    assert.equal(res.status, 400);
  });

  it('tire les couleurs au sort', async () => {
    // On remplace le hasard par une valeur fixe pour vérifier les deux cas.
    for (const [randomValue, creatorColor] of [
      [0.1, 'white'],
      [0.9, 'black'],
    ]) {
      const local = await startTestServer({ random: () => randomValue });
      try {
        const alice = await local.login('alice');
        const bob = await local.login('bob');
        const { body } = await local.request('POST', '/api/games', { token: alice.token });
        const res = await local.request('POST', '/api/games/join', {
          token: bob.token,
          body: { code: body.code },
        });
        assert.equal(res.body[creatorColor].id, alice.player.id);
      } finally {
        await local.close();
      }
    }
  });
});

describe('Récit 4 : jouer un coup', () => {
  // Ces cas vérifient les règles d'accès avant la validation chess.js.
  it('enregistre le coup et l’adversaire le voit', async () => {
    const game = await api.startGame();
    const res = await api.request('POST', `/api/games/${game.code}/moves`, {
      token: game.white.token,
      body: { from: 'e2', to: 'e4' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.moves, ['e4']);
    assert.equal(res.body.turn, 'black');

    // L'adversaire interroge l'API et voit la nouvelle position.
    const seen = await api.request('GET', `/api/games/${game.code}`, { token: game.black.token });
    assert.equal(seen.body.fen, res.body.fen);
    assert.deepEqual(seen.body.lastMove, { from: 'e2', to: 'e4' });
    assert.equal(seen.body.yourColor, 'black');
  });

  it('refuse un coup illégal', async () => {
    const game = await api.startGame();
    const res = await api.request('POST', `/api/games/${game.code}/moves`, {
      token: game.white.token,
      body: { from: 'e2', to: 'e5' },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /illégal/);
  });

  it('refuse un coup hors tour', async () => {
    const game = await api.startGame();
    const res = await api.request('POST', `/api/games/${game.code}/moves`, {
      token: game.black.token,
      body: { from: 'e7', to: 'e5' },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /pas votre tour/);
  });

  it('refuse un coup dans une partie terminée', async () => {
    const game = await api.startGame();
    await api.request('POST', `/api/games/${game.code}/resign`, { token: game.black.token });
    const res = await api.request('POST', `/api/games/${game.code}/moves`, {
      token: game.white.token,
      body: { from: 'e2', to: 'e4' },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /terminée/);
  });

  it('refuse un coup dans une partie pas encore commencée', async () => {
    const { token } = await api.login('alice');
    const { body } = await api.request('POST', '/api/games', { token });
    const res = await api.request('POST', `/api/games/${body.code}/moves`, {
      token,
      body: { from: 'e2', to: 'e4' },
    });
    assert.equal(res.status, 409);
  });

  it('refuse un joueur qui ne participe pas à la partie', async () => {
    const game = await api.startGame();
    const carol = await api.login('carol');
    const res = await api.request('POST', `/api/games/${game.code}/moves`, {
      token: carol.token,
      body: { from: 'e2', to: 'e4' },
    });
    assert.equal(res.status, 403);
  });

  it('refuse un coup mal formé', async () => {
    const game = await api.startGame();
    const res = await api.request('POST', `/api/games/${game.code}/moves`, {
      token: game.white.token,
      body: { from: 'z9', to: 'e4' },
    });
    assert.equal(res.status, 400);
  });
});

describe('Récit 5 : abandonner', () => {
  // L'abandon termine la partie et modifie les deux classements.
  it('fait perdre celui qui abandonne et met à jour les deux Elo', async () => {
    const game = await api.startGame();
    const res = await api.request('POST', `/api/games/${game.code}/resign`, {
      token: game.white.token,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'finished');
    assert.equal(res.body.result, 'black');
    assert.equal(res.body.reason, 'resignation');
    assert.equal(res.body.white.eloAfter, 990);
    assert.equal(res.body.black.eloAfter, 1010);
  });

  it('ne peut pas abandonner deux fois', async () => {
    const game = await api.startGame();
    await api.request('POST', `/api/games/${game.code}/resign`, { token: game.white.token });
    const res = await api.request('POST', `/api/games/${game.code}/resign`, {
      token: game.black.token,
    });
    assert.equal(res.status, 409);
  });
});

describe('Récit 6 : fin de partie, classements et historique', () => {
  // Mat, pat, historique et classement sont vérifiés après des parties terminées.
  it('termine par mat (le « mat du lion », le plus rapide possible) et met à jour les Elo', async () => {
    const game = await api.startGame();
    const res = await api.playSan(game, ['f3', 'e5', 'g4', 'Qh4#']);
    assert.equal(res.body.status, 'finished');
    assert.equal(res.body.result, 'black');
    assert.equal(res.body.reason, 'checkmate');

    const white = await api.request('GET', '/api/me', { token: game.white.token });
    const black = await api.request('GET', '/api/me', { token: game.black.token });
    assert.equal(white.body.elo, 990);
    assert.equal(black.body.elo, 1010);
  });

  it('termine par pat (nulle), Elo inchangés à force égale', async () => {
    const game = await api.startGame();
    // Pat le plus rapide connu (Sam Loyd), 10 coups.
    const res = await api.playSan(game, [
      'e3', 'a5', 'Qh5', 'Ra6', 'Qxa5', 'h5', 'h4', 'Rah6', 'Qxc7', 'f6',
      'Qxd7+', 'Kf7', 'Qxb7', 'Qd3', 'Qxb8', 'Qh7', 'Qxc8', 'Kg6', 'Qe6',
    ]);
    assert.equal(res.body.result, 'draw');
    assert.equal(res.body.reason, 'stalemate');
    assert.equal(res.body.white.eloAfter, 1000);
    assert.equal(res.body.black.eloAfter, 1000);
  });

  it('ajoute la partie à l’historique des deux joueurs', async () => {
    const game = await api.startGame();
    await api.request('POST', `/api/games/${game.code}/resign`, { token: game.black.token });

    const whiteHistory = await api.request('GET', '/api/me/games', { token: game.white.token });
    assert.equal(whiteHistory.body.length, 1);
    assert.equal(whiteHistory.body[0].outcome, 'win');
    assert.equal(whiteHistory.body[0].eloAfter, 1010);

    const blackHistory = await api.request('GET', '/api/me/games', { token: game.black.token });
    assert.equal(blackHistory.body[0].outcome, 'loss');
    assert.equal(blackHistory.body[0].opponent, game.white.player.name);
  });

  it('classe les joueurs par Elo', async () => {
    const game = await api.startGame();
    await api.request('POST', `/api/games/${game.code}/resign`, { token: game.black.token });
    const res = await api.request('GET', '/api/leaderboard');
    assert.equal(res.body[0].id, game.white.player.id);
    assert.equal(res.body[0].elo, 1010);
  });
});

describe('Persistance', () => {
  // Ce groupe ferme puis recrée l'API avec le même fichier SQLite.
  it('une partie survit à un redémarrage du serveur', async () => {
    // Ici on a besoin d'un vrai fichier : une base en mémoire disparaît avec le serveur.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'echecs-'));
    const dbFile = path.join(dir, 'test.sqlite');
    try {
      const first = await startTestServer({ dbFile });
      const game = await first.startGame();
      await first.playSan(game, ['e4']);
      await first.close(); // "redémarrage"

      const second = await startTestServer({ dbFile });
      try {
        const seen = await second.request('GET', `/api/games/${game.code}`, {
          token: game.black.token, // la session aussi a survécu
        });
        assert.equal(seen.status, 200);
        assert.deepEqual(seen.body.moves, ['e4']);
        const next = await second.request('POST', `/api/games/${game.code}/moves`, {
          token: game.black.token,
          body: { from: 'e7', to: 'e5' },
        });
        assert.equal(next.status, 200);
      } finally {
        await second.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
