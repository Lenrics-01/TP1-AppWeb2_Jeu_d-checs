// La partie. Premier affichage rendu côté serveur (l'échiquier est dans le HTML),
// puis mises à jour côté client : polling (useChessGame) et coups envoyés par fetcher.
import { useState } from 'react';
import { Link, data, redirect, useFetcher } from 'react-router';
import { apiOrLogin } from '../api.js';
import { requireToken } from '../session.js';
import ChessBoard from '../components/ChessBoard.jsx';
import { useChessGame } from '../useChessGame.js';

export function meta({ params }) {
  return [{ title: `Partie ${params.code} — Échecs en ligne` }];
}

export async function loader({ request, params }) {
  const token = await requireToken(request);
  const res = await apiOrLogin(`/api/games/${params.code}`, { token });
  if (!res.ok) throw data(res.data?.error ?? 'Partie introuvable.', { status: res.status });
  if (res.data.status === 'waiting') throw redirect(`/lobby/${res.data.code}`);
  return { game: res.data };
}

// Jouer un coup ou abandonner. C'est l'API qui vérifie tout (tour, légalité,
// partie terminée) ; ici on relaie seulement sa réponse ou son message d'erreur.
export async function action({ request, params }) {
  const token = await requireToken(request);
  const form = await request.formData();
  const intent = form.get('intent');
  let res;
  if (intent === 'move') {
    res = await apiOrLogin(`/api/games/${params.code}/moves`, {
      token,
      method: 'POST',
      body: {
        from: form.get('from'),
        to: form.get('to'),
        promotion: form.get('promotion') || undefined,
      },
    });
  } else if (intent === 'resign') {
    res = await apiOrLogin(`/api/games/${params.code}/resign`, { token, method: 'POST' });
  } else {
    return { error: 'Action inconnue.' };
  }
  if (!res.ok) return { error: res.data?.error ?? 'Action refusée.' };
  return { game: res.data };
}

const REASONS = {
  checkmate: 'par mat',
  stalemate: 'par pat',
  resignation: 'par abandon',
  repetition: 'par triple répétition',
  insufficient_material: 'par matériel insuffisant',
  fifty_moves: 'par la règle des 50 coups',
};

export default function Game({ loaderData }) {
  // La version la plus récente de la partie : celle du loader (premier affichage,
  // ou après notre coup) ou celle reçue par le polling (coup de l'adversaire).
  const game = useChessGame(loaderData.game);
  // useFetcher envoie un coup ou l'abandon à l'action de cette page, sans changer d'URL.
  // mover.state : 'idle' ou envoi en cours ; mover.data : la réponse de l'action.
  const mover = useFetcher();
  // État local : true pendant qu'on demande la confirmation de l'abandon.
  const [confirmResign, setConfirmResign] = useState(false);

  // Valeurs calculées à chaque rendu à partir de la partie : pas besoin de useState.
  const me = game.yourColor;
  const opponent = me === 'white' ? 'black' : 'white';
  const active = game.status === 'active';
  const myTurn = active && game.turn === me;
  const pending = mover.state !== 'idle';

  // Appelée par l'échiquier (prop onMove). C'est l'API qui décide si le coup est légal.
  function playMove(from, to, promotion) {
    mover.submit({ intent: 'move', from, to, promotion: promotion ?? '' }, { method: 'post' });
  }

  // Récit 5 : abandonner, après confirmation.
  function resign() {
    setConfirmResign(false);
    mover.submit({ intent: 'resign' }, { method: 'post' });
  }

  return (
    <div className="game-layout">
      <div className="board-column">
        {/* L'adversaire en haut, soi-même en bas. */}
        <PlayerBar player={game[opponent]} color={opponent} toMove={active && game.turn === opponent} />
        {/* On ne peut cliquer que si c'est notre tour et qu'aucun envoi n'est en cours. */}
        <ChessBoard
          fen={game.fen}
          orientation={me}
          canMove={myTurn && !pending}
          lastMove={game.lastMove}
          onMove={playMove}
        />
        <PlayerBar player={game[me]} color={me} toMove={myTurn} you />
      </div>

      <aside className="card side-panel">
        <p className="muted small">Partie {game.code}</p>

        {/* Partie en cours : statut, erreur et abandon. Partie terminée : le résultat. */}
        {active ? (
          // <>...</> (fragment) : regroupe plusieurs éléments sans ajouter de balise.
          <>
            {/* Un coup noté en SAN qui finit par « + » met le roi adverse en échec. */}
            <p className={`status ${myTurn ? 'my-turn' : ''}`}>
              {myTurn ? 'À vous de jouer' : 'Au tour de l’adversaire…'}
              {game.moves.at(-1)?.endsWith('+') && ' — échec !'}
            </p>
            {/* Récit 4 : le refus de l'API (coup illégal, hors tour, partie terminée). */}
            {mover.data?.error && (
              <p className="error" role="alert">
                {mover.data.error}
              </p>
            )}
            {/* Premier clic : on demande confirmation. Deuxième clic : on abandonne. */}
            {confirmResign ? (
              <div className="row">
                <button type="button" className="danger" onClick={resign}>
                  Confirmer l’abandon
                </button>
                <button type="button" className="secondary" onClick={() => setConfirmResign(false)}>
                  Annuler
                </button>
              </div>
            ) : (
              <button type="button" className="secondary" onClick={() => setConfirmResign(true)} disabled={pending}>
                Abandonner
              </button>
            )}
          </>
        ) : (
          <GameResult game={game} />
        )}

        <h2>Coups</h2>
        <MoveList moves={game.moves} />
      </aside>
    </div>
  );
}

// Le bandeau d'un joueur : couleur, nom et Elo. toMove le surligne quand c'est à lui de jouer.
// Après la partie, on affiche son nouvel Elo (eloAfter) plutôt que l'ancien.
function PlayerBar({ player, color, toMove, you = false }) {
  return (
    <div className={`player-bar ${toMove ? 'to-move' : ''}`}>
      <span className={`swatch ${color}`} aria-hidden="true" />
      <span className="player-name">
        {player?.name ?? '—'} {you && <span className="muted">(vous)</span>}
      </span>
      <span className="elo">{player?.eloAfter ?? player?.elo}</span>
    </div>
  );
}

// Récit 6 : le résultat et les deux classements mis à jour.
function GameResult({ game }) {
  // Le titre dépend du point de vue : le même résultat est une victoire pour l'un,
  // une défaite pour l'autre.
  let title;
  if (game.result === 'draw') title = 'Partie nulle';
  else if (game.result === game.yourColor) title = 'Victoire !';
  else title = 'Défaite';

  return (
    <div className="result">
      <h2>{title}</h2>
      <p>{REASONS[game.reason] ?? game.reason}</p>
      <table>
        <tbody>
          {/* Une ligne par joueur : nom, Elo avant → après, et l'écart. */}
          {['white', 'black'].map((color) => {
            const p = game[color];
            const delta = p.eloAfter - p.eloBefore;
            return (
              <tr key={color}>
                <td>
                  <span className={`swatch ${color}`} aria-hidden="true" /> {p.name}
                </td>
                <td>
                  {p.eloBefore} → <strong>{p.eloAfter}</strong>{' '}
                  <span className={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>
                    ({delta > 0 ? `+${delta}` : delta === 0 ? '±0' : delta})
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Link to="/" className="button">
        Retour à l’accueil
      </Link>
    </div>
  );
}

// La liste des coups, deux par ligne comme sur une feuille de partie :
// « 1. e4 e5 », « 2. Nf3 Nc6 »... (moves[0] = blancs, moves[1] = noirs, etc.).
function MoveList({ moves }) {
  if (moves.length === 0) return <p className="muted">Aucun coup joué.</p>;
  // On regroupe les coups par paires : une ligne = un coup des blancs + la réponse des noirs.
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ number: i / 2 + 1, white: moves[i], black: moves[i + 1] });
  }
  return (
    <ol className="move-list">
      {rows.map((row) => (
        <li key={row.number}>
          <span className="muted">{row.number}.</span> <span>{row.white}</span>{' '}
          <span>{row.black ?? ''}</span>
        </li>
      ))}
    </ol>
  );
}
