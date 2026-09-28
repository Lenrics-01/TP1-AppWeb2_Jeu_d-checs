-- Les joueurs, identifiés par leur compte GitHub
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    elo INTEGER NOT NULL DEFAULT 1000
);

-- Les parties créées
CREATE TABLE IF NOT EXISTS games (
    code TEXT PRIMARY KEY,
    player_white_id INTEGER,
    player_black_id INTEGER,
    fen TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'active', 'finished'
    result TEXT, -- 'white_wins', 'black_wins', 'draw', NULL
    FOREIGN KEY (player_white_id) REFERENCES players(id),
    FOREIGN KEY (player_black_id) REFERENCES players(id)
);

-- L'historique des coups pour chaque partie
CREATE TABLE IF NOT EXISTS moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_code TEXT NOT NULL,
    san_move TEXT NOT NULL,
    move_number INTEGER NOT NULL,
    FOREIGN KEY (game_code) REFERENCES games(code)
);
