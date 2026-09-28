# Déploiement

La machine n'a besoin que de **Docker** (avec `docker compose`). Pas de Node, pas de code source : seulement ce dossier (`compose.yml` et un `.env`).

## 1. Application GitHub OAuth

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App :

- Homepage URL : `http://localhost:3000` (ou l'adresse de la machine)
- Authorization callback URL : `http://localhost:3000/login`

Notez le *Client ID* et générez un *Client secret*.

## 2. Configuration

```bash
cp .env.example .env
```

Dans `.env`, remplir :

- `TAG` : le tag `sha-xxxxxxx` publié par la CI pour le commit marqué `v1` (onglet *Actions* du dépôt, ou page du paquet sur GitHub). On n'utilise pas `latest` : ce tag change à chaque push, alors que `sha-xxxxxxx` désigne toujours la même image.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` : ceux de l'application OAuth.
- `SESSION_SECRET` : une longue chaîne aléatoire, par exemple la sortie de `openssl rand -hex 32`.

Les secrets ne sont que dans ce `.env`, sur la machine : jamais dans le dépôt, jamais dans les images.

## 3. Démarrer

```bash
docker compose up -d        # télécharge les images et démarre
docker compose logs -f      # voir les journaux
```

Le site est sur `http://localhost:3000` (ou le `PORT` choisi).

## Arrêter, mettre à jour

```bash
docker compose down         # arrête et supprime les conteneurs ; le volume reste
docker compose down -v      # supprime AUSSI le volume : toutes les parties sont perdues
```

Pour une nouvelle version : changer `TAG` dans `.env`, puis `docker compose up -d`.

## Où vivent les données

La base SQLite est le fichier `/data/echecs.sqlite` du conteneur `server`, dans le volume nommé `echecs-data`. Un redémarrage, un `docker compose down` ou une mise à jour de l'image ne l'effacent pas. Seul `docker compose down -v` (ou `docker volume rm`) le supprime.
