import { getDb } from './index';

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

    INSERT OR IGNORE INTO app_config (key, value) VALUES ('visits_per_tree', '10');

    CREATE INDEX IF NOT EXISTS idx_visits_customer_id ON visits(customer_id);
    CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
  `);
}
