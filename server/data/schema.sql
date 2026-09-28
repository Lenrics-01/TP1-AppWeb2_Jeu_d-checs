-- Schéma de la base SQLite. Exécuté à chaque démarrage (CREATE ... IF NOT EXISTS),
-- donc sans effet si les tables existent déjà.

-- Les joueurs, identifiés par leur compte GitHub.
-- Le CHECK garantit que l'Elo reste dans l'intervalle permis, même en cas de bogue.
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    elo INTEGER NOT NULL DEFAULT 1000 CHECK (elo BETWEEN 100 AND 3000)
);

-- Les sessions de l'API : un jeton aléatoire associé à un joueur.
-- En base plutôt qu'en mémoire : un redémarrage ne déconnecte personne.
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Les parties. Le code d'invitation sert aussi d'identifiant.
-- status : 'waiting' (code pas encore utilisé), 'active', 'finished'.
-- La position (fen) vit ici, pas dans la mémoire du serveur.
CREATE TABLE IF NOT EXISTS games (
    code TEXT PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES players(id),
    white_id INTEGER REFERENCES players(id),
    black_id INTEGER REFERENCES players(id),
    fen TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'active', 'finished')),
    result TEXT CHECK (result IN ('white', 'black', 'draw')),
    end_reason TEXT,          -- 'checkmate', 'stalemate', 'resignation', ...
    white_elo_before INTEGER,
    white_elo_after INTEGER,
    black_elo_before INTEGER,
    black_elo_after INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT
);

CREATE INDEX IF NOT EXISTS games_white_id ON games(white_id);
CREATE INDEX IF NOT EXISTS games_black_id ON games(black_id);

-- La liste des coups de chaque partie, dans l'ordre (ply = demi-coup, à partir de 1).
-- La clé primaire (game_code, ply) empêche d'enregistrer deux coups au même rang.
CREATE TABLE IF NOT EXISTS moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_code TEXT NOT NULL,
    san_move TEXT NOT NULL,
    move_number INTEGER NOT NULL,
    fen_after TEXT NOT NULL,
    FOREIGN KEY (game_code) REFERENCES games(code)
);
