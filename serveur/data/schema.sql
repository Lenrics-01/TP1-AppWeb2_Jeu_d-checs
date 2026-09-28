PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
	github_id TEXT NOT NULL UNIQUE,
	username TEXT NOT NULL,
	elo INTEGER NOT NULL DEFAULT 1000 CHECK (elo BETWEEN 100 AND 3000),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'maintenant'))
);

CREATE TABLE IF NOT EXISTS games (
	id INTEGER PRIMARY KEY,
	invite_code TEXT UNIQUE,
	host_player_id INTEGER NOT NULL REFERENCES players(github_id) ON DELETE RESTRICT,
	white_player_id INTEGER REFERENCES players(github_id) ON DELETE RESTRICT,
	black_player_id INTEGER REFERENCES players(github_id) ON DELETE RESTRICT,
	status TEXT NOT NULL DEFAULT 'attente'
		CHECK (status IN ('attente', 'active', 'finished')),
	result TEXT CHECK (result IN ('white', 'black', 'draw')),
	end_reason TEXT CHECK (end_reason IN ('checkmate', 'draw', 'resignation')),
	fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'maintenant')),
	started_at TEXT,
	ended_at TEXT,
	CHECK (white_player_id IS NULL OR black_player_id IS NULL OR white_player_id <> black_player_id),
	CHECK (status <> 'attente' OR (invite_code IS NOT NULL AND white_player_id IS NULL AND black_player_id IS NULL)),
	CHECK (status <> 'active' OR (
		invite_code IS NULL
		AND white_player_id IS NOT NULL
		AND black_player_id IS NOT NULL
		AND (host_player_id = white_player_id OR host_player_id = black_player_id)
	)),
	CHECK (status <> 'fini' OR (result IS NOT NULL AND end_reason IS NOT NULL AND ended_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS moves (
	id INTEGER PRIMARY KEY,
	game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
	ply INTEGER NOT NULL CHECK (ply > 0),
	player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
	san TEXT NOT NULL,
	uci TEXT NOT NULL,
	fen_after TEXT NOT NULL,
	played_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'maintenant')),
	UNIQUE (game_id, ply)
);

CREATE INDEX IF NOT EXISTS idx_games_host_player ON games(host_player_id);
CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_moves_game_ply ON moves(game_id, ply);
