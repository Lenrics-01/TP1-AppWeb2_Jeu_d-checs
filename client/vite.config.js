import { reactRouter } from '@react-router/dev/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // En développement, on lit le fichier .env à la racine du dépôt (le même que
  // l'API) et on le copie dans process.env, que lisent nos loaders et actions.
  // En production, les variables viennent directement de docker compose.
  Object.assign(process.env, loadEnv(mode, '..', ''), { ...process.env });

  return {
    plugins: [reactRouter()],
    // Même port qu'en production : une seule URL de rappel dans l'application GitHub OAuth.
    server: { port: 3000 },
  };
});
