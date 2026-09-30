import express from 'express';
import { loadPlayer, requireAuth } from './session.js';
import { updateRatings } from './elo.js';
import { START_FEN, replay, turnColor, tryMove, outcome, colorOf, opponentOf } from './game.js';

/**
 * Construit l'application Express. Toutes les dépendances sont passées en paramètre
 * (base, client GitHub, hasard) : les tests peuvent ainsi fournir une base en mémoire,
 * un faux GitHub et un tirage des couleurs prévisible.
 */
export function createApp({ repo, github, devLogin = false, random = Math.random }) {
  const app = express();
  app.use(express.json());
  app.use(loadPlayer(repo));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // ---------------------------------------------------------------- Connexion

  // Récit 1 : je me connecte (GitHub) et j'obtiens un nom et un Elo (1000 la première fois).
  app.post('/api/auth/github', async (req, res) => {
    const { code, redirectUri } = req.body ?? {};
    if (typeof code !== 'string' || !code) {
      return res.status(400).json({ error: 'Code GitHub manquant.' });
    }
    let profile;
    try {
      profile = await github.exchangeCode(code, redirectUri);
    } catch {
      return res.status(401).json({ error: 'La connexion avec GitHub a échoué.' });
    }
    const player = repo.accounts.upsertFromGithub(profile);
    const token = repo.accounts.createSession(player.id);
    res.status(201).json({ token, player });
  });

  // Connexion sans GitHub, pour tester à deux sur un seul poste. Désactivée par
  // défaut : la route n'existe que si DEV_LOGIN=true. Jamais en production.
  if (devLogin) {
    app.post('/api/auth/dev', (req, res) => {
      const name = String(req.body?.name ?? '').trim();
      if (!name) return res.status(400).json({ error: 'Nom manquant.' });
      const player = repo.accounts.upsertFromGithub({ githubId: `dev:${name}`, name });
      const token = repo.accounts.createSession(player.id);
      res.status(201).json({ token, player });
    });
  }

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    repo.accounts.deleteSession(req.token);
    res.status(204).end();
  });

  app.get('/api/me', requireAuth, (req, res) => res.json(req.player));

  // Récit 6 : l'historique de mes parties terminées.
  app.get('/api/me/games', requireAuth, (req, res) => {
    const games = repo.games.history(req.player.id);
    res.json(games.map((game) => historyEntry(game, req.player.id)));
  });

  app.get('/api/leaderboard', (req, res) => res.json(repo.accounts.leaderboard(10)));

  // ------------------------------------------------------------ Partie privée

  // Récit 2 : je crée une partie privée et je reçois un code.
  app.post('/api/games', requireAuth, (req, res) => {
    const code = repo.games.create(req.player.id, START_FEN);
    res.status(201).json({ code });
  });

  // Récit 3 : j'entre un code et je rejoins la partie.
  app.post('/api/games/join', requireAuth, (req, res) => {
    const code = normalizeCode(req.body?.code);
    const game = code && repo.games.find(code);
    if (!game) {
      return res.status(404).json({ error: 'Ce code ne correspond à aucune partie.' });
    }
    if (game.status !== 'waiting') {
      return res.status(409).json({ error: 'Ce code a déjà été utilisé.' });
    }
    if (game.creator_id === req.player.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas jouer contre vous-même.' });
    }
    // Les couleurs sont tirées au sort au moment où l'adversaire rejoint.
    const creatorIsWhite = random() < 0.5;
    const whiteId = creatorIsWhite ? game.creator_id : req.player.id;
    const blackId = creatorIsWhite ? req.player.id : game.creator_id;
    if (!repo.games.join(code, whiteId, blackId)) {
      // Quelqu'un d'autre a utilisé le code entre la lecture et l'écriture.
      return res.status(409).json({ error: 'Ce code a déjà été utilisé.' });
    }
    res.json(gameView(code, req.player.id));
  });

  // L'état d'une partie. Appelée toutes les secondes par le client (interrogation périodique).
  app.get('/api/games/:code', requireAuth, (req, res) => {
    const game = loadGameFor(req, res);
    if (!game) return;
    res.json(gameView(game.code, req.player.id));
  });

  // ------------------------------------------------------------------- Coups

  // Récit 4 : je joue un coup quand c'est mon tour.
  // Refusé : coup illégal (400), hors tour (409), partie terminée ou pas commencée (409).
  app.post('/api/games/:code/moves', requireAuth, (req, res) => {
    const game = loadGameFor(req, res);
    if (!game) return;
    if (!requireActive(game, res)) return;

    const moves = repo.games.listMoves(game.code);
    const chess = replay(moves.map((m) => m.san));
    if (turnColor(chess) !== colorOf(game, req.player.id)) {
      return res.status(409).json({ error: "Ce n'est pas votre tour." });
    }

    const { from, to, promotion } = req.body ?? {};
    if (!isSquare(from) || !isSquare(to) || (promotion != null && !/^[qrbn]$/.test(promotion))) {
      return res.status(400).json({ error: 'Coup mal formé.' });
    }
    const move = tryMove(chess, { from, to, promotion: promotion ?? undefined });
    if (!move) {
      return res.status(400).json({ error: 'Coup illégal.' });
    }

    const end = outcome(chess);
    // Le coup et, s'il termine la partie, le résultat et les nouveaux Elo :
    // tout est écrit ensemble ou rien ne l'est.
    repo.transaction(() => {
      repo.games.addMove({
        code: game.code,
        ply: moves.length + 1,
        san: move.san,
        from: move.from,
        to: move.to,
        fen: chess.fen(),
      });
      if (end) finishGame(game.code, end);
    });
    res.json(gameView(game.code, req.player.id));
  });

  // Récit 5 : j'abandonne. La partie est perdue pour moi, gagnée pour l'adversaire.
  app.post('/api/games/:code/resign', requireAuth, (req, res) => {
    const game = loadGameFor(req, res);
    if (!game) return;
    if (!requireActive(game, res)) return;
    const winner = opponentOf(colorOf(game, req.player.id));
    repo.transaction(() => finishGame(game.code, { result: winner, reason: 'resignation' }));
    res.json(gameView(game.code, req.player.id));
  });

  // ------------------------------------------------------------ Gestion d'erreurs

  app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status ?? err.statusCode ?? 500;
    res.status(status).json({ error: status === 500 ? 'Erreur interne du serveur.' : err.message });
  });

  // ------------------------------------------------------------ Fonctions utiles

  /** Charge la partie et vérifie que le joueur connecté y participe. */
  function loadGameFor(req, res) {
    const game = repo.games.find(normalizeCode(req.params.code));
    if (!game) {
      res.status(404).json({ error: 'Partie introuvable.' });
      return null;
    }
    // Le créateur peut suivre sa partie en attente ; ensuite, seuls les deux joueurs.
    const isCreator = game.creator_id === req.player.id;
    if (!isCreator && !colorOf(game, req.player.id)) {
      res.status(403).json({ error: 'Vous ne participez pas à cette partie.' });
      return null;
    }
    return game;
  }

  function requireActive(game, res) {
    if (game.status === 'waiting') {
      res.status(409).json({ error: "La partie n'a pas encore commencé." });
      return false;
    }
    if (game.status === 'finished') {
      res.status(409).json({ error: 'La partie est terminée.' });
      return false;
    }
    return true;
  }

  /**
   * Termine la partie et met à jour le classement des deux joueurs.
   * À appeler dans une transaction. On relit les Elo en base juste avant le calcul.
   */
  function finishGame(code, { result, reason }) {
    const game = repo.games.find(code);
    const ratings = updateRatings(game.white_elo, game.black_elo, result);
    const finished = repo.games.finish({
      code,
      result,
      reason,
      white: { before: game.white_elo, after: ratings.white },
      black: { before: game.black_elo, after: ratings.black },
    });
    if (!finished) {
      throw Object.assign(new Error('La partie est terminée.'), { status: 409 });
    }
    repo.accounts.setElo(game.white_id, ratings.white);
    repo.accounts.setElo(game.black_id, ratings.black);
  }

  /** Ce que le client reçoit pour afficher une partie. */
  function gameView(code, playerId) {
    const game = repo.games.find(code);
    const moves = repo.games.listMoves(code);
    const player = (color) =>
      game[`${color}_id`] == null
        ? null
        : {
            id: game[`${color}_id`],
            name: game[`${color}_name`],
            elo: game[`${color}_elo`],
            eloBefore: game[`${color}_elo_before`],
            eloAfter: game[`${color}_elo_after`],
          };
    return {
      code: game.code,
      status: game.status,
      fen: game.fen,
      turn: game.fen.split(' ')[1] === 'w' ? 'white' : 'black',
      moves: moves.map((m) => m.san),
      lastMove: moves.length ? { from: moves.at(-1).from, to: moves.at(-1).to } : null,
      white: player('white'),
      black: player('black'),
      yourColor: colorOf(game, playerId),
      result: game.result,
      reason: game.end_reason,
    };
  }

  return app;
}

/** Une ligne d'historique, du point de vue du joueur. */
function historyEntry(game, playerId) {
  const color = colorOf(game, playerId);
  const opponent = opponentOf(color);
  return {
    code: game.code,
    finishedAt: game.finished_at,
    color,
    opponent: game[`${opponent}_name`],
    outcome: game.result === 'draw' ? 'draw' : game.result === color ? 'win' : 'loss',
    reason: game.end_reason,
    eloBefore: game[`${color}_elo_before`],
    eloAfter: game[`${color}_elo_after`],
  };
}

function normalizeCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

function isSquare(value) {
  return typeof value === 'string' && /^[a-h][1-8]$/.test(value);
}
