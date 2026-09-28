BEGIN TRANSACTION;

INSERT OR IGNORE INTO players (github_id, name, elo)
VALUES
	('test-github-1001', 'AliceDemo', 1200),
	('test-github-1002', 'BobDemo', 1100),
	('test-github-1003', 'CharlieDemo', 1000);

INSERT OR IGNORE INTO games (code, player_white_id, player_black_id, fen, status)
VALUES
	(
		'TEST-WAITING',
		NULL,
		NULL,
		'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
		'waiting'
	),
	(
		'TEST-ACTIVE',
		(SELECT id FROM players WHERE github_id = 'test-github-1001'),
		(SELECT id FROM players WHERE github_id = 'test-github-1002'),
		'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
		'active'
	);

INSERT OR IGNORE INTO moves (game_code, san_move, move_number, fen_after)
VALUES
	('TEST-ACTIVE', 'e4', 1, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'),
	('TEST-ACTIVE', 'e5', 2, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'),
	('TEST-ACTIVE', 'Nf3', 3, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');

COMMIT;
