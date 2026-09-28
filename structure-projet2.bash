#!/usr/bin/env bash

cat <<'TREE'
projet-2-echecs/
├── .github/
│   └── workflows/
│       └── ci.yml
├── client/
│   ├── Dockerfile
│   ├── package.json
│   ├── react-router.config.js
│   ├── server.js
│   ├── vite.config.js
│   └── app/
│       ├── api-url.js
│       ├── api.js
│       ├── root.jsx
│       ├── routes.js
│       ├── session.js
│       ├── styles.css
│       ├── useChessGame.js
│       ├── components/
│       │   ├── ChessBoard.jsx
│       │   └── Leaderboard.jsx
│       └── routes/
│           ├── game.jsx
│           ├── home.jsx
│           ├── lobby.jsx
│           ├── login.jsx
│           └── logout.jsx
├── deploy/
│   ├── .env.example
│   ├── README.md
│   └── compose.yml
├── server/
│   ├── Dockerfile
│   ├── package.json
│   ├── data/
│   │   ├── schema.sql
│   │   └── seed.sql
│   ├── src/
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── elo.js
│   │   ├── server.js
│   │   ├── session.js
│   │   └── repository/
│   │       ├── accounts.js
│   │       ├── db.js
│   │       ├── games.js
│   │       └── index.js
│   └── test/
│       ├── elo.test.js
│       ├── games.test.js
│       └── helpers.js
├── .gitignore
├── README.md
├── compose.yml
└── package.json
TREE
