import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');

/**
 * Ouvre (ou crée) la base SQLite et s'assure que les tables existent.
 * - En production : un fichier sur un volume Docker (DB_PATH=/data/echecs.sqlite).
 * - En test : ':memory:', une base neuve et vide pour chaque test.
 */
export function openDatabase(file = ':memory:') {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  // SQLite n'applique les clés étrangères que si on le demande.
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(dataFolder, 'schema.sql'), 'utf-8'));
  return db;
}

/** Ajoute quelques joueurs de démonstration (pour le classement en développement). */
export function seedDatabase(db) {
  db.exec(fs.readFileSync(path.join(dataFolder, 'seed.sql'), 'utf-8'));
}
