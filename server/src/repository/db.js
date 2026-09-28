import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// On place la base de données dans le dossier data.
const dbFolder = path.join(__dirname, '..', '..', 'data');
const dbPath = process.env.DB_PATH || path.join(dbFolder, 'database.sqlite');

const db = new DatabaseSync(dbPath);

// Exécuter le schéma pour s'assurer que les tables existent
const schemaPath = path.join(dbFolder, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

export default db;
