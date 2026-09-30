// Adresse de l'API, vue depuis le serveur du client. Le navigateur ne parle
// jamais directement à l'API : ce sont les loaders et actions (exécutés côté
// serveur) qui l'appellent. En Docker : http://server:4000 (nom du service).
//
// Une fonction plutôt qu'une constante : process.env n'est lu qu'au moment de
// l'appel, donc uniquement côté serveur.
export function apiUrl() {
  return process.env.API_URL ?? 'http://localhost:4000';
}
