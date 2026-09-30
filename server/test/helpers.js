// Outils communs aux tests d'intégration.
// Chaque test démarre une vraie API Express sur un port libre, avec une base
// SQLite en mémoire : rapide, isolée (aucun test ne voit les données d'un autre)
// et sans fichier à nettoyer. Seul GitHub est remplacé par un faux.
import { Chess } from 'chess.js';
import { createApp } from '../src/app.js';
import { createRepository, openDatabase } from '../src/repository/index.js';

/** Faux GitHub : le code "user-alice" correspond à l'utilisateur alice. */
const fakeGithub = {
  async exchangeCode(code) {
    if (!code.startsWith('user-')) throw new Error('code refusé');
    const login = code.slice('user-'.length);
    return { githubId: `gh-${login}`, name: login };
  },
};

export async function startTestServer({ dbFile = ':memory:', random } = {}) {
  const repo = createRepository(openDatabase(dbFile));
  const app = createApp({ repo, github: fakeGithub, random });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  /** Envoie une requête à l'API et renvoie { status, body }. */
  async function request(method, path, { token, body } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  /** Connecte un joueur via le faux GitHub et renvoie { token, player }. */
  async function login(name) {
    const res = await request('POST', '/api/auth/github', { body: { code: `user-${name}` } });
    return res.body;
  }

  /**
   * Alice crée une partie, Bob la rejoint. Les couleurs étant tirées au sort,
   * on renvoie les joueurs rangés par couleur : { code, white, black }.
   */
  async function startGame(creatorName = 'alice', joinerName = 'bob') {
    const creator = await login(creatorName);
    const joiner = await login(joinerName);
    const { body } = await request('POST', '/api/games', { token: creator.token });
    const joined = await request('POST', '/api/games/join', {
      token: joiner.token,
      body: { code: body.code },
    });
    const creatorIsWhite = joined.body.white.id === creator.player.id;
    return {
      code: body.code,
      white: creatorIsWhite ? creator : joiner,
      black: creatorIsWhite ? joiner : creator,
    };
  }

  /** Joue une suite de coups en notation algébrique, en alternant les joueurs. */
  async function playSan(game, sanMoves) {
    const chess = new Chess();
    let res;
    for (const san of sanMoves) {
      const player = chess.turn() === 'w' ? game.white : game.black;
      const { from, to, promotion } = chess.move(san);
      res = await request('POST', `/api/games/${game.code}/moves`, {
        token: player.token,
        body: { from, to, promotion },
      });
      if (res.status !== 200) throw new Error(`${san} refusé : ${JSON.stringify(res.body)}`);
    }
    return res;
  }

  async function close() {
    // fetch garde les connexions ouvertes (keep-alive) : on les ferme d'abord.
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    repo.close();
  }

  return { baseUrl, repo, request, login, startGame, playSan, close };
}
