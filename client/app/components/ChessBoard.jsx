// L'échiquier. Clic sur une pièce puis sur une case pour jouer.
// chess.js sert ici seulement à l'affichage (pièces, cases permises, échec) :
// la validation qui compte est celle de l'API. Promotion : toujours en dame.
import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';

// ︎ force l'affichage en texte (sinon certains téléphones affichent ♟ en emoji).
const GLYPHS = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const NAMES = { k: 'roi', q: 'dame', r: 'tour', b: 'fou', n: 'cavalier', p: 'pion' };
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * Props :
 * - fen : la position à afficher (texte FEN reçu de l'API) ;
 * - orientation : 'white' ou 'black', le camp affiché en bas ;
 * - canMove : true si le joueur peut cliquer (c'est son tour) ;
 * - lastMove : { from, to }, pour surligner le dernier coup joué ;
 * - onMove(from, to, promotion) : appelée quand le joueur joue un coup.
 */
export default function ChessBoard({ fen, orientation = 'white', canMove = false, lastMove, onMove }) {
  // useMemo : on recrée l'objet Chess seulement quand la position change, pas à chaque rendu.
  const chess = useMemo(() => new Chess(fen), [fen]);
  // La case choisie au premier clic (ex. 'e2'), ou null si rien n'est sélectionné.
  const [selected, setSelected] = useState(null);

  // Nouvelle position (coup joué ou reçu) : on oublie la sélection.
  useEffect(() => setSelected(null), [fen]);
  // Plus notre tour (ou coup en cours d'envoi) : on oublie aussi la sélection.
  useEffect(() => {
    if (!canMove) setSelected(null);
  }, [canMove]);

  // Les coups permis depuis la case choisie, pour les montrer sur l'échiquier.
  const targets = useMemo(
    () => (selected ? chess.moves({ square: selected, verbose: true }) : []),
    [chess, selected],
  );
  // La case du roi en échec, colorée en rouge (null s'il n'y a pas d'échec).
  const checkSquare = chess.inCheck() ? findKing(chess, chess.turn()) : null;

  // Du point de vue du joueur : ses pièces en bas.
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'white' ? FILES : [...FILES].reverse();

  // Clic sur une case :
  // - sur une case permise → on joue le coup (le parent l'envoie à l'API) ;
  // - sur une de ses pièces → on la sélectionne (ou on la désélectionne si elle l'était) ;
  // - ailleurs → on annule la sélection.
  function handleClick(square) {
    if (!canMove) return;
    const move = targets.find((m) => m.to === square);
    if (move) {
      onMove(move.from, move.to, move.promotion ? 'q' : undefined);
      setSelected(null);
      return;
    }
    // chess.get renvoie la pièce de la case ({ type, color }) ou undefined si elle est vide.
    const piece = chess.get(square);
    if (piece && piece.color === chess.turn()) {
      setSelected(square === selected ? null : square);
    } else {
      setSelected(null);
    }
  }

  return (
    <div className={`board ${canMove ? 'interactive' : ''}`} role="grid" aria-label="Échiquier">
      {/* 64 cases : une boucle sur les rangées, puis une sur les colonnes.
          La grille CSS (styles.css) les place sur 8 colonnes. */}
      {ranks.map((rank, row) =>
        files.map((file, col) => {
          const square = `${file}${rank}`;
          const piece = chess.get(square);
          const target = targets.find((m) => m.to === square);
          // Les classes CSS de la case : sa couleur, puis les surlignages éventuels.
          // filter(Boolean) retire les « false » des conditions non remplies.
          const classes = [
            'square',
            (FILES.indexOf(file) + rank) % 2 === 0 ? 'light' : 'dark',
            square === selected && 'selected',
            target && (piece ? 'capture' : 'target'),
            (lastMove?.from === square || lastMove?.to === square) && 'last',
            square === checkSquare && 'check',
          ]
            .filter(Boolean)
            .join(' ');

          // Chaque case est un <button> : cliquable à la souris et au clavier.
          // aria-label décrit la case pour les lecteurs d'écran (ex. « e2 pion blanc »).
          return (
            <button
              key={square}
              type="button"
              className={classes}
              onClick={() => handleClick(square)}
              aria-label={piece ? `${square} ${NAMES[piece.type]} ${piece.color === 'w' ? 'blanc' : 'noir'}` : square}
            >
              {piece && (
                <span className={`piece ${piece.color === 'w' ? 'white' : 'black'}`}>
                  {GLYPHS[piece.type]}
                  {'︎'}
                </span>
              )}
              {/* Coordonnées : les chiffres sur la première colonne, les lettres sur la dernière rangée. */}
              {col === 0 && <span className="coord rank">{rank}</span>}
              {row === 7 && <span className="coord file">{file}</span>}
            </button>
          );
        }),
      )}
    </div>
  );
}

// La case du roi d'une couleur ('w' ou 'b'). chess.board() renvoie l'échiquier
// sous forme de 8 rangées de 8 cases (null pour une case vide).
function findKing(chess, color) {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === color) return cell.square;
    }
  }
  return null;
}
