import { getDb } from './index';
import { config } from '../config';

export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      total_visits INTEGER NOT NULL DEFAULT 0,
      trees_planted INTEGER NOT NULL DEFAULT 0,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      visited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_visits_customer_id ON visits(customer_id);
    CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
  `);

  db.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES ('visits_per_tree', ?)`).run(
    String(config.visitsPerTree),
  );

  for (const col of [
    'ALTER TABLE visits ADD COLUMN user_agent TEXT',
    'ALTER TABLE visits ADD COLUMN ip TEXT',
  ]) {
    try { db.exec(col); } catch { /* already exists */ }
  }

  for (const col of [
    'ALTER TABLE visits ADD COLUMN country TEXT',
    'ALTER TABLE visits ADD COLUMN country_code TEXT',
    'ALTER TABLE visits ADD COLUMN city TEXT',
    'ALTER TABLE visits ADD COLUMN language TEXT',
  ]) {
    try { db.exec(col); } catch { /* already exists */ }
  }
}
