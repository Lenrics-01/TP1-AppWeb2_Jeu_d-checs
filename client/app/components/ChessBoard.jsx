// L'échiquier. Clic sur une pièce puis sur une case pour jouer.
// chess.js sert ici seulement à l'affichage (pièces, cases permises, échec) :
// la validation qui compte est celle de l'API. Promotion : toujours en dame.
import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';

// ︎ force l'affichage en texte (sinon certains téléphones affichent ♟ en emoji).
const GLYPHS = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const NAMES = { k: 'roi', q: 'dame', r: 'tour', b: 'fou', n: 'cavalier', p: 'pion' };
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export default function ChessBoard({ fen, orientation = 'white', canMove = false, lastMove, onMove }) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState(null);

  // Nouvelle position (coup joué ou reçu) : on oublie la sélection.
  useEffect(() => setSelected(null), [fen]);
  useEffect(() => {
    if (!canMove) setSelected(null);
  }, [canMove]);

  const targets = useMemo(
    () => (selected ? chess.moves({ square: selected, verbose: true }) : []),
    [chess, selected],
  );
  const checkSquare = chess.inCheck() ? findKing(chess, chess.turn()) : null;

  // Du point de vue du joueur : ses pièces en bas.
  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'white' ? FILES : [...FILES].reverse();

  function handleClick(square) {
    if (!canMove) return;
    const move = targets.find((m) => m.to === square);
    if (move) {
      onMove(move.from, move.to, move.promotion ? 'q' : undefined);
      setSelected(null);
      return;
    }
    const piece = chess.get(square);
    if (piece && piece.color === chess.turn()) {
      setSelected(square === selected ? null : square);
    } else {
      setSelected(null);
    }
  }

  return (
    <div className={`board ${canMove ? 'interactive' : ''}`} role="grid" aria-label="Échiquier">
      {ranks.map((rank, row) =>
        files.map((file, col) => {
          const square = `${file}${rank}`;
          const piece = chess.get(square);
          const target = targets.find((m) => m.to === square);
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
              {col === 0 && <span className="coord rank">{rank}</span>}
              {row === 7 && <span className="coord file">{file}</span>}
            </button>
          );
        }),
      )}
    </div>
  );
}

function findKing(chess, color) {
  for (const row of chess.board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === color) return cell.square;
    }
  }
  return null;
}
