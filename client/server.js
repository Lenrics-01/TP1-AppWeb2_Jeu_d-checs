// Serveur de production du client : sert les fichiers statiques construits par
// "react-router build" et confie toutes les autres requêtes à React Router,
// qui exécute les loaders/actions et fait le rendu côté serveur.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { createRequestHandler } from '@react-router/express';

const buildDir = path.join(import.meta.dirname, 'build');
// pathToFileURL : import() exige une URL file:// sous Windows (C:\...).
const build = await import(pathToFileURL(path.join(buildDir, 'server', 'index.js')).href);
const port = Number(process.env.PORT ?? 3000);

const app = express();
app.disable('x-powered-by');

// Les fichiers de /assets ont un hash dans leur nom : on peut les garder en cache un an.
app.use(
  '/assets',
  express.static(path.join(buildDir, 'client', 'assets'), { immutable: true, maxAge: '1y' }),
);
app.use(express.static(path.join(buildDir, 'client'), { maxAge: '1h' }));

app.use(createRequestHandler({ build }));

const server = app.listen(port, () => {
  console.log(`Client prêt sur http://localhost:${port}`);
});

// docker compose stop envoie SIGTERM. server.close() attend la fin des requêtes en
// cours (un loader qui attend l'API, par exemple) : sans closeAllConnections(), Docker
// perd patience et tue le conteneur (code 137) au lieu d'un arrêt propre (code 0).
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
}
