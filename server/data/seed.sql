-- Données de démonstration, chargées seulement si SEED_DB=true (jamais en test).
-- Les github_id commencent par "seed:" pour ne jamais entrer en collision
-- avec un vrai identifiant GitHub (qui est numérique).
INSERT OR IGNORE INTO players (github_id, name, elo) VALUES
    ('seed:magnus', 'Magnus (démo)', 1850),
    ('seed:judit', 'Judit (démo)', 1620),
    ('seed:bobby', 'Bobby (démo)', 1240),
    ('seed:debutant', 'Débutant (démo)', 880);
