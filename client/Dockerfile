# Image du client React Router. Construite depuis la racine du dépôt :
#   docker build -f client/Dockerfile .

# --- Étape 1 : construction (avec les dépendances de développement : Vite, etc.)
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace=client
COPY client/ client/
RUN npm run build --workspace=client

# --- Étape 2 : exécution (seulement le résultat du build et les dépendances de prod)
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace=client --omit=dev
COPY --from=build /app/client/build client/build
COPY client/server.js client/

WORKDIR /app/client
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server.js"]
