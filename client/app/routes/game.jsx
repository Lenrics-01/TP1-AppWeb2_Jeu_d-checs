// La partie. Premier affichage rendu côté serveur (l'échiquier est dans le HTML),
// puis mises à jour côté client : polling (useChessGame) et coups envoyés par fetcher.
// useState conserve l'état temporaire de confirmation de l'abandon.
import { useState } from 'react';
// Link navigue sans rechargement; data et redirect contrôlent les loaders;
// useFetcher envoie des actions sans changer l'adresse de la page.
import { Link, data, redirect, useFetcher } from 'react-router';
// Cette fonction appelle l'API et redirige vers la connexion si nécessaire.
import { apiOrLogin } from '../api.js';
// Une partie ne peut pas être chargée par un visiteur anonyme.
import { requireToken } from '../session.js';
// L'échiquier gère les clics et remonte le coup choisi au parent.
import ChessBoard from '../components/ChessBoard.jsx';
// Le hook fusionne le jeu initial avec les mises à jour de l'adversaire.
import { useChessGame } from '../useChessGame.js';

export function meta({ params }) {
  // params.code vient du segment dynamique games/:code.
  return [{ title: `Partie ${params.code} — Échecs en ligne` }];
}

export async function loader({ request, params }) {
  // Le cookie permet au serveur du client de transmettre le bon Bearer token.
  const token = await requireToken(request);
  // L'état initial contient la FEN, les joueurs, le tour et l'historique SAN.
  const res = await apiOrLogin(`/api/games/${params.code}`, { token });
  // data transforme une erreur API en erreur de route affichée par ErrorBoundary.
  if (!res.ok) throw data(res.data?.error ?? 'Partie introuvable.', { status: res.status });
  // Une partie non commencée doit rester dans le salon, pas sur l'échiquier.
  if (res.data.status === 'waiting') throw redirect(`/lobby/${res.data.code}`);
  // Le composant reçoit un objet stable nommé game pour correspondre à useChessGame.
  return { game: res.data };
}

// Jouer un coup ou abandonner. C'est l'API qui vérifie tout (tour, légalité,
// partie terminée) ; ici on relaie seulement sa réponse ou son message d'erreur.
export async function action({ request, params }) {
  // Toutes les écritures de cette page passent par cette action serveur.
  const token = await requireToken(request);
  // Le formulaire virtuel de useFetcher contient intent et les champs du coup.
  const form = await request.formData();
  // intent permet de partager une action entre jouer et abandonner.
  const intent = form.get('intent');
  // res sera rempli par l'appel API correspondant à l'intention.
  let res;
  if (intent === 'move') {
    // Les valeurs FormData sont des chaînes; l'API valide ensuite les cases et la promotion.
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
    // L'abandon ne nécessite ni cases ni promotion.
    res = await apiOrLogin(`/api/games/${params.code}/resign`, { token, method: 'POST' });
  } else {
    // Une intention inconnue ne doit jamais être interprétée comme un coup.
    return { error: 'Action inconnue.' };
  }
  // Les erreurs sont renvoyées au composant pour rester visibles sans navigation.
  if (!res.ok) return { error: res.data?.error ?? 'Action refusée.' };
  // Une action réussie renvoie la nouvelle vue complète de la partie.
  return { game: res.data };
}

// Traduction des codes internes de fin de partie en phrases lisibles.
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
  // Le loader donne la première version; le hook la remplace seulement par une version plus récente.
  const game = useChessGame(loaderData.game);
  // useFetcher envoie un coup ou l'abandon à l'action de cette page, sans changer d'URL.
  // mover.state : 'idle' ou envoi en cours ; mover.data : la réponse de l'action.
  // Ce fetcher est distinct du fetcher interne de useChessGame, donc un polling
  // ne peut pas écraser l'état d'envoi d'un coup.
  const mover = useFetcher();
  // État local : true pendant qu'on demande la confirmation de l'abandon.
  const [confirmResign, setConfirmResign] = useState(false);

  // Valeurs calculées à chaque rendu à partir de la partie : pas besoin de useState.
  // yourColor vaut white ou black et permet d'orienter l'échiquier vers le joueur.
  const me = game.yourColor;
  // L'autre couleur sert à afficher l'adversaire au-dessus du plateau.
  const opponent = me === 'white' ? 'black' : 'white';
  // Une partie active accepte des coups; une partie terminée affiche le résultat.
  const active = game.status === 'active';
  // Le joueur ne peut jouer que si la couleur du tour correspond à la sienne.
  const myTurn = active && game.turn === me;
  // pending évite deux clics pendant que le serveur traite le premier coup.
  const pending = mover.state !== 'idle';

  // Appelée par l'échiquier (prop onMove). C'est l'API qui décide si le coup est légal.
  function playMove(from, to, promotion) {
    // La promotion est vide pour un coup ordinaire et q/r/b/n pour un pion promu.
    mover.submit({ intent: 'move', from, to, promotion: promotion ?? '' }, { method: 'post' });
  }

  // Récit 5 : abandonner, après confirmation.
  function resign() {
    // La confirmation disparaît avant l'envoi pour éviter un double abandon.
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
  // player peut être null dans un salon; l'opérateur ?. affiche alors un tiret.
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
  // Le résultat renvoyé par l'API est global; le titre doit être calculé selon le joueur courant.
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
  // Une liste vide est un état normal au début d'une partie.
  if (moves.length === 0) return <p className="muted">Aucun coup joué.</p>;
  // On regroupe les coups par paires : une ligne = un coup des blancs + la réponse des noirs.
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    // i pointe vers le coup blanc; i+1 est le coup noir éventuel.
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
