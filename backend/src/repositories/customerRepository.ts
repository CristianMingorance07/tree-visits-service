import Database from 'better-sqlite3';
import { getDb } from '../db';

export interface CustomerRow {
  id: string;
  total_visits: number;
  trees_planted: number;
  last_seen: string;
}

export interface AggregateStatsRow {
  totalTreesPlanted: number;
  totalCustomers: number;
  totalVisits: number;
}

export function upsertCustomerVisit(customerId: string, db: Database.Database): void {
  db.prepare(`
    INSERT INTO customers (id, total_visits, trees_planted, last_seen)
    VALUES (?, 1, 0, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      total_visits = total_visits + 1,
      last_seen = datetime('now')
  `).run(customerId);
}

export function getCustomerById(
  customerId: string,
  db: Database.Database = getDb(),
): CustomerRow | undefined {
  return db
    .prepare(`SELECT id, total_visits, trees_planted, last_seen FROM customers WHERE id = ?`)
    .get(customerId) as CustomerRow | undefined;
}

export function listCustomers(db: Database.Database = getDb()): CustomerRow[] {
  return db
    .prepare(`SELECT id, total_visits, trees_planted, last_seen FROM customers ORDER BY trees_planted DESC, total_visits DESC`)
    .all() as CustomerRow[];
}

export function incrementTreesPlanted(customerId: string, db: Database.Database): void {
  db.prepare(`UPDATE customers SET trees_planted = trees_planted + 1 WHERE id = ?`).run(customerId);
}

export function getAggregateStats(db: Database.Database = getDb()): AggregateStatsRow {
  return db
    .prepare(`
      SELECT
        COALESCE(SUM(trees_planted), 0) as totalTreesPlanted,
        COUNT(*) as totalCustomers,
        COALESCE(SUM(total_visits), 0) as totalVisits
      FROM customers
    `)
    .get() as AggregateStatsRow;
}

export function getTrackedTreesPlanted(db: Database.Database = getDb()): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(c.trees_planted), 0) as realTrees
    FROM customers c
    WHERE EXISTS (
      SELECT 1 FROM visits v
      WHERE v.customer_id = c.id AND v.user_agent IS NOT NULL
    )
  `).get() as { realTrees: number };

  return row.realTrees;
}
