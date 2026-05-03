import Database from 'better-sqlite3';
import { getDb } from '../db';

interface ConfigRow {
  value: string;
}

function parseVisitsPerTree(value: string): number {
  const n = parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid visits_per_tree config value: "${value}"`);
  }
  return n;
}

export function getVisitsPerTree(db: Database.Database = getDb()): number {
  const row = db
    .prepare(`SELECT value FROM app_config WHERE key = 'visits_per_tree'`)
    .get() as ConfigRow | undefined;

  if (!row) throw new Error('Config key visits_per_tree is missing from app_config');
  return parseVisitsPerTree(row.value);
}

export function updateVisitsPerTree(visitsPerTree: number, db: Database.Database = getDb()): void {
  db.prepare(`UPDATE app_config SET value = ? WHERE key = 'visits_per_tree'`).run(
    String(visitsPerTree),
  );
}
