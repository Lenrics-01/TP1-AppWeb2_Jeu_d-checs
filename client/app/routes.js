import { index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.jsx'), //                 /             accueil, créer/rejoindre, historique
  route('login', 'routes/login.jsx'), //       /login        connexion GitHub
  route('logout', 'routes/logout.jsx'), //     /logout       déconnexion (POST)
  route('lobby/:code', 'routes/lobby.jsx'), // /lobby/ABC123 salle d'attente avec le code
  route('games/:code', 'routes/game.jsx'), //  /games/ABC123 la partie
];
