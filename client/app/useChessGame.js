// Interrogation périodique de l'API pour voir le coup de l'adversaire.
//
// Toutes les secondes, un fetcher recharge le loader de la page de partie
// (/games/:code), qui appelle GET /api/games/:code côté serveur. Le fetcher ne
// relance QUE ce loader (pas celui de la racine) et ne provoque pas de navigation.
// Le polling s'arrête quand la partie est terminée ou que l'onglet est caché.
import { useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';

const POLL_INTERVAL_MS = 1000;

// Plus une partie a de coups, plus elle est récente ; à nombre égal, une partie
// terminée (abandon) est plus récente qu'une partie en cours.
function version(game) {
  return game.moves.length * 2 + (game.status === 'finished' ? 1 : 0);
}

/**
 * Renvoie la version la plus récente de la partie : celle du loader (rendu serveur,
 * ou rechargée après un de nos coups) ou celle reçue par le polling.
 */
export function useChessGame(loaderGame) {
  const poller = useFetcher({ key: `poll-${loaderGame.code}` });
  const polled = poller.data?.game;
  const game =
    polled && polled.code === loaderGame.code && version(polled) > version(loaderGame)
      ? polled
      : loaderGame;

  const pollerRef = useRef(poller);
  pollerRef.current = poller;

  useEffect(() => {
    if (game.status === 'finished') return;
    const id = setInterval(() => {
      const p = pollerRef.current;
      if (p.state === 'idle' && document.visibilityState === 'visible') {
        p.load(`/games/${game.code}`);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [game.code, game.status]);

  return game;
}
