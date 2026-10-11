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
// Tous les environnements passent par cette fonction afin d'utiliser exactement
// le même schéma SQL. Cela évite qu'un test et la production aient des tables
// différentes par accident.
export function openDatabase(file = ':memory:') {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  // SQLite n'applique les clés étrangères que si on le demande.
  db.exec('PRAGMA foreign_keys = ON');
  // schema.sql contient CREATE TABLE IF NOT EXISTS : l'appel est idempotent et
  // peut être fait à chaque démarrage sans effacer les données existantes.
  db.exec(fs.readFileSync(path.join(dataFolder, 'schema.sql'), 'utf-8'));
  return db;
}

/** Ajoute quelques joueurs de démonstration (pour le classement en développement). */
export function seedDatabase(db) {
  // Le seed est optionnel et réservé au développement; server.js l'active avec
  // la variable d'environnement SEED_DB=true.
  db.exec(fs.readFileSync(path.join(dataFolder, 'seed.sql'), 'utf-8'));
}
