import { index, route } from '@react-router/dev/routes';

// La configuration associe chaque URL à un module de route. Chaque module peut
// exporter un loader (lecture), une action (écriture) et un composant (affichage).
export default [
  index('routes/home.jsx'), //                 /             accueil, créer/rejoindre, historique
  route('login', 'routes/login.jsx'), //       /login        connexion GitHub
  route('logout', 'routes/logout.jsx'), //     /logout       déconnexion (POST)
  route('lobby/:code', 'routes/lobby.jsx'), // /lobby/ABC123 salle d'attente avec le code
  route('games/:code', 'routes/game.jsx'), //  /games/ABC123 la partie
];
