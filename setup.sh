#!/usr/bin/env bash
# Préparation de l'environnement de développement (Git Bash sous Windows, ou Linux/macOS).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Fichier .env créé à partir de .env.example : ajoutez vos identifiants GitHub OAuth."
fi

npm install

echo
echo "Prêt. Lancez :"
echo "  npm test      # tests de l'API"
echo "  npm run dev   # API sur http://localhost:4000 et site sur http://localhost:3000"
