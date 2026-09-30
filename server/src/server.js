// Point d'entrée de l'API : lit la configuration dans l'environnement,
// ouvre la base et démarre Express.
import { createApp } from './app.js';
import { createGithubClient } from './auth.js';
import { createRepository, openDatabase, seedDatabase } from './repository/index.js';

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;
const dbPath = process.env.DB_PATH ?? 'data/echecs.sqlite';
const port = Number(process.env.PORT ?? 4000);

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn('GITHUB_CLIENT_ID ou GITHUB_CLIENT_SECRET manquant : la connexion GitHub échouera.');
}

const db = openDatabase(dbPath);
if (process.env.SEED_DB === 'true') seedDatabase(db);
const repo = createRepository(db);

const app = createApp({
  repo,
  github: createGithubClient({ clientId: GITHUB_CLIENT_ID, clientSecret: GITHUB_CLIENT_SECRET }),
  devLogin: process.env.DEV_LOGIN === 'true',
});

const server = app.listen(port, () => {
  console.log(`API prête sur http://localhost:${port} (base : ${dbPath})`);
});

// docker compose stop envoie SIGTERM : on ferme proprement la base avant de quitter.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => {
      repo.close();
      process.exit(0);
    });
  });
}
