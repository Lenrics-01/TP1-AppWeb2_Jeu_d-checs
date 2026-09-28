# Jeu d'échecs en ligne — Applications Web 2, projet 1

Deux personnes jouent aux échecs, chacune dans son navigateur. On se connecte avec GitHub, on crée une partie privée, on envoie le code à son adversaire. Chaque partie terminée (mat, nulle ou abandon) met à jour le classement Elo des deux joueurs.

- **API** : Express + SQLite (`node:sqlite`), dans `server/`
- **Client** : React Router en mode framework (rendu côté serveur), dans `client/`
- **Règles des échecs** : [chess.js](https://github.com/jhlywa/chess.js)

## Démarrer en développement

Prérequis : Node.js 22.13 ou plus récent (24 recommandé).

1. Créer une application GitHub OAuth de développement (GitHub → Settings → Developer settings → OAuth Apps) :
   - Homepage URL : `http://localhost:3000`
   - Authorization callback URL : `http://localhost:3000/login`
2. Préparer le projet :
   ```bash
   ./setup.sh          # copie .env.example en .env, puis npm install
   ```
   (ou à la main : `cp .env.example .env` puis `npm install`)
3. Remplir `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET` dans `.env`.
4. Lancer :
   ```bash
   npm run dev         # API sur http://localhost:4000, site sur http://localhost:3000
   npm test            # tests unitaires et d'intégration de l'API
   ```

**Tester à deux joueurs sur un seul poste** : avec `DEV_LOGIN=true` (valeur par défaut du `.env` de développement), la page `/login` propose aussi une connexion par nom, sans GitHub. Ouvrez une fenêtre normale et une fenêtre de navigation privée, avec deux noms différents. Cette route n'existe pas en production.

Pour essayer les images Docker localement à partir du code source : `docker compose up --build` (voir `compose.yml`).

## Démarrer sur la machine de déploiement

La machine n'a besoin que de Docker. Le code source n'y est pas : les images sont téléchargées depuis ghcr.io. Voir [`deploy/README.md`](deploy/README.md).

```bash
cd deploy
cp .env.example .env    # puis remplir : TAG, identifiants GitHub, SESSION_SECRET
docker compose up -d
```

## Architecture

```
navigateur ──HTTP──▶ client (React Router, :3000) ──HTTP + jeton──▶ API (Express, :4000) ──▶ SQLite (volume)
```

- Le **navigateur ne parle qu'au client**. Les loaders et actions de React Router s'exécutent côté serveur et appellent l'API avec le jeton de session (`Authorization: Bearer ...`).
- Le **jeton de l'API** est gardé dans un cookie signé, `httpOnly`, du client (`client/app/session.js`). Le JavaScript du navigateur ne le voit jamais.
- **Tout le SQL** est dans `server/src/repository/`. Les routes (`app.js`) n'appellent que des fonctions comme `repo.games.find(code)`.
- **La position vit dans la base** : la FEN dans `games.fen` et la liste des coups dans `moves`. À chaque coup, l'API relit la partie en base et rejoue les coups avec chess.js (ce qui permet aussi de détecter la triple répétition). Rien n'est gardé en mémoire : un redémarrage ne perd aucune partie. Les sessions aussi sont en base, donc personne n'est déconnecté.
- **Mise à jour de l'échiquier adverse** : toutes les secondes, un `fetcher` recharge le loader de la page de partie, qui appelle `GET /api/games/:code` (`client/app/useChessGame.js`).

### Rendu côté serveur ou côté client

| Route | Rendu | Pourquoi |
|---|---|---|
| `/` (accueil, classement, historique) | serveur | Les données arrivent dans le HTML, sans écran de chargement ; le jeton reste côté serveur. |
| `/games/:code` | serveur au premier affichage, puis client | L'échiquier est visible tout de suite ; ensuite, le polling et les coups mettent à jour la page sans la recharger. |
| `/lobby/:code` | serveur puis polling | Affiche le code, puis redirige vers la partie dès que l'adversaire rejoint. |
| `/login`, `/logout` | serveur seulement | Redirections OAuth et gestion du cookie : rien à afficher côté client. |

### Choix de chess.js

- Bibliothèque de référence pour les règles (coups légaux, échec, mat, pat, nulles), très utilisée et testée.
- Sans dépendance, et utilisable **des deux côtés** : l'API s'en sert pour valider (c'est elle qui fait foi), le client pour afficher les cases permises.
- Intégration : tout passe par `server/src/game.js` (`replay`, `tryMove`, `outcome`). Le reste du serveur ne connaît pas chess.js.

## L'API

Toutes les routes, sauf la connexion et le classement, exigent `Authorization: Bearer <jeton>`.

| Méthode | Route | Rôle | Refus |
|---|---|---|---|
| POST | `/api/auth/github` | `{ code, redirectUri }` → `{ token, player }` | 401 connexion GitHub échouée |
| POST | `/api/auth/logout` | révoque le jeton | |
| GET | `/api/me` | le joueur connecté (nom, Elo) | 401 |
| GET | `/api/me/games` | historique des parties terminées | |
| GET | `/api/leaderboard` | 10 meilleurs Elo | |
| POST | `/api/games` | crée une partie → `{ code }` | |
| POST | `/api/games/join` | `{ code }` rejoint, couleurs tirées au sort | 404 code inconnu, 409 déjà utilisé, 400 contre soi-même |
| GET | `/api/games/:code` | état de la partie (utilisé par le polling) | 403 si on n'y joue pas |
| POST | `/api/games/:code/moves` | `{ from, to, promotion? }` | 400 illégal, 409 hors tour, 409 partie terminée |
| POST | `/api/games/:code/resign` | abandon : défaite pour soi | 409 partie terminée |

## Tests

`npm test` lance `node --test` dans `server/` :

- `test/elo.test.js` : tests unitaires de la formule Elo (arrondi, bornes 100 et 3000).
- `test/games.test.js` : tests d'intégration, un bloc par récit. Chaque test démarre une vraie API Express sur un port libre, avec une **base SQLite en mémoire** (`:memory:`) : rapide, isolée, rien à nettoyer. Seul GitHub est remplacé par un faux (`test/helpers.js`). Un test utilise un vrai fichier pour vérifier qu'une partie survit à un redémarrage.
- Non testé automatiquement : le client React (vérifié à la main dans le navigateur) et l'échange réel avec GitHub (on ne veut pas dépendre d'un service externe dans les tests).

## Intégration continue

`.github/workflows/ci.yml` : à chaque push sur `main`, `npm ci`, `npm test`, `npm run build`. Si tout passe, les images `server` et `client` sont publiées sur `ghcr.io/lenrics-01/tp1-appweb2-jeu-d-checs-{server,client}` avec les tags `latest` et `sha-<7 premiers caractères du commit>`. Sur une pull request vers `main`, les tests sont lancés mais rien n'est publié.
