import { db } from './db.js';

export function findAccount(githubId) {
  return db.prepare('SELECT * FROM players WHERE github_id = ?').get(githubId);
}

export function createAccount(githubId, name, elo) {
  const stmt = db.prepare('INSERT INTO players (github_id, name, elo) VALUES (?, ?, ?)');
  const info = stmt.run(githubId, name, elo || 1000);
  return info.lastInsertRowid;
}

export function updateAccount(githubId, name, elo) {
  const stmt = db.prepare('UPDATE players SET name = ?, elo = ? WHERE github_id = ?');
  const info = stmt.run(name, elo, githubId);
  return info.changes;
}