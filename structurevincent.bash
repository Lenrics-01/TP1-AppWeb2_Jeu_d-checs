#!/usr/bin/env bash

cat <<'TREE'
2026A-420-5D2-MA-QuizM9/
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
│       ├── useGame.js
│       ├── components/
│       │   ├── Countdown.jsx
│       │   └── Leaderboard.jsx
│       └── routes/
│           ├── catalogue.jsx
│           ├── game.jsx
│           ├── home.jsx
│           ├── lobby.jsx
│           ├── logout.jsx
│           ├── quiz-details.jsx
│           ├── quiz-edit.jsx
│           └── quizzes.jsx
├── deploy/
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
│   │   ├── game.js
│   │   ├── scoring.js
│   │   ├── server.js
│   │   ├── session.js
│   │   └── repository/
│   │       ├── accounts.js
│   │       ├── db.js
│   │       ├── games.js
│   │       ├── index.js
│   │       └── quizzes.js
│   └── test/
│       ├── helpers.js
│       ├── quizzes.test.js
│       └── scoring.test.js
├── .gitignore
├── README.md
├── compose.yml
├── package.json
├── setup.sh
└── structure.bash
TREE
