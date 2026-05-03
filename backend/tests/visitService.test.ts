import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// Captured by reference — reassigned in beforeEach before each test
let db!: Database.Database;

vi.mock('../src/db/index', () => ({
  getDb: () => db,
}));

// Imported after mock is registered so it uses the mocked getDb
const { registerVisit } = await import('../src/services/visitService');

const SCHEMA = `
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
    user_agent TEXT,
    ip TEXT,
    country TEXT,
    country_code TEXT,
    city TEXT,
    language TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  INSERT OR IGNORE INTO app_config (key, value) VALUES ('visits_per_tree', '10');

  CREATE INDEX IF NOT EXISTS idx_visits_customer_id ON visits(customer_id);
  CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
`;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
});

describe('registerVisit', () => {
  it('creates a new customer on first visit', () => {
    const result = registerVisit('device-001');

    expect(result.customerId).toBe('device-001');
    expect(result.totalVisits).toBe(1);
    expect(result.treesPlanted).toBe(0);
    expect(result.treeEarned).toBe(false);
    expect(result.lastSeen).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('increments total_visits on subsequent visits', () => {
    registerVisit('device-002');
    const result = registerVisit('device-002');

    expect(result.totalVisits).toBe(2);
  });

  it('treeEarned is false for all visits before the milestone', () => {
    for (let i = 1; i < 10; i++) {
      const result = registerVisit('device-003');
      expect(result.treeEarned).toBe(false);
    }
  });

  it('treeEarned is true exactly when total_visits reaches a multiple of visitsPerTree', () => {
    for (let i = 0; i < 9; i++) {
      registerVisit('device-004');
    }
    const tenthVisit = registerVisit('device-004');

    expect(tenthVisit.totalVisits).toBe(10);
    expect(tenthVisit.treeEarned).toBe(true);
    expect(tenthVisit.treesPlanted).toBe(1);
  });

  it('trees_planted increments correctly at each milestone', () => {
    for (let i = 0; i < 20; i++) {
      registerVisit('device-005');
    }

    const row = db
      .prepare('SELECT trees_planted FROM customers WHERE id = ?')
      .get('device-005') as { trees_planted: number };
    expect(row.trees_planted).toBe(2);
  });

  it('treeEarned resets to false after a milestone', () => {
    for (let i = 0; i < 10; i++) {
      registerVisit('device-006');
    }
    const eleventhVisit = registerVisit('device-006');

    expect(eleventhVisit.treeEarned).toBe(false);
    expect(eleventhVisit.treesPlanted).toBe(1);
  });

  it('accumulates visits correctly across multiple calls', () => {
    for (let i = 0; i < 7; i++) {
      registerVisit('device-007');
    }
    const result = registerVisit('device-007');

    expect(result.totalVisits).toBe(8);
  });

  it('changing visitsPerTree changes milestone behaviour', () => {
    db.prepare("UPDATE app_config SET value = '5' WHERE key = 'visits_per_tree'").run();

    for (let i = 0; i < 4; i++) {
      const r = registerVisit('device-008');
      expect(r.treeEarned).toBe(false);
    }

    const fifth = registerVisit('device-008');
    expect(fifth.totalVisits).toBe(5);
    expect(fifth.treeEarned).toBe(true);
    expect(fifth.treesPlanted).toBe(1);
  });

  it('last_seen is updated to approximately now on each visit', () => {
    const before = Date.now();
    const result = registerVisit('device-009');
    const after = Date.now();

    const ts = new Date(result.lastSeen).getTime();
    // SQLite CURRENT_TIMESTAMP has second-level precision; allow ±2s tolerance
    expect(ts).toBeGreaterThanOrEqual(before - 2000);
    expect(ts).toBeLessThanOrEqual(after + 2000);
  });
});
