// Point d'entrée de l'API : lit la configuration dans l'environnement,
// ouvre la base et démarre Express.
// createApp contient les routes; ce fichier ne fait que composer l'application réelle.
import { createApp } from './app.js';
// Le client GitHub garde le secret OAuth côté serveur.
import { createGithubClient } from './auth.js';
// Le repository regroupe l'accès SQLite et son initialisation.
import { createRepository, openDatabase, seedDatabase } from './repository/index.js';

// Les variables d'environnement permettent de changer la configuration sans modifier le code.
const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;
const dbPath = process.env.DB_PATH ?? 'data/echecs.sqlite';
const port = Number(process.env.PORT ?? 4000);

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('GITHUB_CLIENT_ID ou GITHUB_CLIENT_SECRET manquant : la connexion GitHub échouera.');
}

// openDatabase crée le fichier et les tables si nécessaire.
const db = openDatabase(dbPath);
if (process.env.SEED_DB === 'true') seedDatabase(db);
// Les routes utilisent cette façade plutôt que db directement.
const repo = createRepository(db);

const app = createApp({
  repo,
  github: createGithubClient({ clientId: GITHUB_CLIENT_ID, clientSecret: GITHUB_CLIENT_SECRET }),
  devLogin: process.env.DEV_LOGIN === 'true',
});

// listen démarre le serveur HTTP et appelle le callback une fois le port prêt.
const server = app.listen(port, () => {
  console.log(`API prête sur http://localhost:${port} (base : ${dbPath})`);
});

// docker compose stop envoie SIGTERM : on ferme proprement la base avant de quitter.
// closeAllConnections() : sans lui, server.close() attendrait la fin des requêtes en
// cours, et Docker pourrait tuer le conteneur (code 137) avant la fermeture de la base.
for (const signal of ['SIGTERM', 'SIGINT']) {
  // Docker et Ctrl+C utilisent ces signaux pour demander un arrêt propre.
  process.on(signal, () => {
    server.close(() => {
      repo.close();
      process.exit(0);
    });
    server.closeAllConnections();
  });
}
