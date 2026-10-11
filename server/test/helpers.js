// Outils communs aux tests d'intégration.
// Chaque test démarre une vraie API Express sur un port libre, avec une base
// SQLite en mémoire : rapide, isolée (aucun test ne voit les données d'un autre)
// et sans fichier à nettoyer. Seul GitHub est remplacé par un faux.
// chess.js prépare les suites de coups envoyées à l'API.
import { Chess } from 'chess.js';
// createApp construit la même application que celle lancée en production.
import { createApp } from '../src/app.js';
// La base mémoire isole chaque serveur de test.
import { createRepository, openDatabase } from '../src/repository/index.js';

/** Faux GitHub : le code "user-alice" correspond à l'utilisateur alice. */
const fakeGithub = {
  async exchangeCode(code) {
    // Le faux accepte uniquement les codes fabriqués par login().
    if (!code.startsWith('user-')) throw new Error('code refusé');
    // Le suffixe devient à la fois le nom et un identifiant stable.
    const login = code.slice('user-'.length);
    return { githubId: `gh-${login}`, name: login };
  },
};

export async function startTestServer({ dbFile = ':memory:', random } = {}) {
  // Chaque appel crée une base, une application et un port séparés.
  const repo = createRepository(openDatabase(dbFile));
  // random peut être remplacé pour tester l'attribution des couleurs.
  const app = createApp({ repo, github: fakeGithub, random });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  // Les requêtes utilisent l'adresse du port choisi automatiquement par l'OS.
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  /** Envoie une requête à l'API et renvoie { status, body }. */
  async function request(method, path, { token, body } = {}) {
    // Les headers sont construits seulement quand l'appel possède réellement
    // un corps JSON ou un token d'authentification.
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // text permet de représenter correctement une réponse 204 par body null.
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  /** Connecte un joueur via le faux GitHub et renvoie { token, player }. */
  async function login(name) {
    // Le faux OAuth transforme ce code en joueur local.
    const res = await request('POST', '/api/auth/github', { body: { code: `user-${name}` } });
    return res.body;
  }

  /**
   * Alice crée une partie, Bob la rejoint. Les couleurs étant tirées au sort,
   * on renvoie les joueurs rangés par couleur : { code, white, black }.
   */
  async function startGame(creatorName = 'alice', joinerName = 'bob') {
    // Cette fonction reproduit le parcours complet créer puis rejoindre.
    const creator = await login(creatorName);
    const joiner = await login(joinerName);
    const { body } = await request('POST', '/api/games', { token: creator.token });
    const joined = await request('POST', '/api/games/join', {
      token: joiner.token,
      body: { code: body.code },
    });
    // La réponse de join donne les couleurs finales après le tirage aléatoire.
    const creatorIsWhite = joined.body.white.id === creator.player.id;
    return {
      code: body.code,
      white: creatorIsWhite ? creator : joiner,
      black: creatorIsWhite ? joiner : creator,
    };
  }

  /** Joue une suite de coups en notation algébrique, en alternant les joueurs. */
  async function playSan(game, sanMoves) {
    // Le helper joue depuis un historique local pour obtenir from/to/promotion.
    const chess = new Chess();
    let res;
    for (const san of sanMoves) {
      // Le tour local indique quel token doit envoyer le prochain coup.
      const player = chess.turn() === 'w' ? game.white : game.black;
      // chess.js convertit SAN en coordonnées utilisables par l'API.
      const { from, to, promotion } = chess.move(san);
      res = await request('POST', `/api/games/${game.code}/moves`, {
        token: player.token,
        body: { from, to, promotion },
      });
      // Une suite invalide arrête immédiatement le test avec le détail de l'API.
      if (res.status !== 200) throw new Error(`${san} refusé : ${JSON.stringify(res.body)}`);
    }
    return res;
  }

  async function close() {
    // On ferme d'abord les connexions HTTP, puis la base SQLite.
    // fetch garde les connexions ouvertes (keep-alive) : on les ferme d'abord.
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    repo.close();
  }

  return { baseUrl, repo, request, login, startGame, playSan, close };
}
