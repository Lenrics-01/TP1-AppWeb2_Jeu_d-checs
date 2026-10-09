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
  // Un fetcher réservé au polling, distinct de celui qui envoie les coups (game.jsx).
  const poller = useFetcher({ key: `poll-${loaderGame.code}` });
  // La dernière partie reçue par le polling (undefined avant la première réponse).
  const polled = poller.data?.game;
  // On garde la plus récente des deux versions : celle du loader ou celle du polling.
  const game =
    polled && polled.code === loaderGame.code && version(polled) > version(loaderGame)
      ? polled
      : loaderGame;

  // useRef : l'intervalle lit toujours le fetcher le plus récent, sans être recréé
  // à chaque rendu (même technique que dans lobby.jsx).
  const pollerRef = useRef(poller);
  pollerRef.current = poller;

  // L'effet ne se relance que si le code ou le statut de la partie change.
  // La fonction renvoyée (clearInterval) arrête le polling quand on quitte la page.
  useEffect(() => {
    // Partie terminée : plus rien ne peut changer, on n'interroge plus l'API.
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
