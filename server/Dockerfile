# Image de l'API. Construite depuis la racine du dépôt (contexte "."), parce que
# le package-lock.json des workspaces npm est à la racine :
#   docker build -f server/Dockerfile .
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# D'abord les manifestes seuls : tant qu'ils ne changent pas, Docker réutilise la
# couche "npm ci" en cache, même si le code change.
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace=server --omit=dev

COPY server/ server/

WORKDIR /app/server
# La base SQLite est écrite dans /data, monté comme volume par docker compose.
ENV PORT=4000 DB_PATH=/data/echecs.sqlite
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 4000

# Ne pas exécuter en root.
USER node
CMD ["node", "src/server.js"]
