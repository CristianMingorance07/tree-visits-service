import { getDb } from '../db';
import { toISO } from '../utils/date';

export interface VisitResult {
  customerId: string;
  totalVisits: number;
  treesPlanted: number;
  treeEarned: boolean;
  lastSeen: string;
}

export interface VisitMeta {
  userAgent?: string;
  ip?: string;
}

interface CustomerRow {
  total_visits: number;
  trees_planted: number;
  last_seen: string;
}

interface ConfigRow {
  value: string;
}

function parseVisitsPerTree(value: string): number {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) throw new Error(`Invalid visits_per_tree config value: "${value}"`);
  return n;
}

export function registerVisit(customerId: string, meta?: VisitMeta): VisitResult {
  const db = getDb();

  const transaction = db.transaction((id: string): VisitResult => {
    db.prepare(`
      INSERT INTO customers (id, total_visits, trees_planted, last_seen)
      VALUES (?, 1, 0, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        total_visits = total_visits + 1,
        last_seen = datetime('now')
    `).run(id);

    db.prepare(
      `INSERT INTO visits (customer_id, visited_at, user_agent, ip) VALUES (?, datetime('now'), ?, ?)`,
    ).run(id, meta?.userAgent ?? null, meta?.ip ?? null);

    const customer = db
      .prepare(`SELECT total_visits, trees_planted, last_seen FROM customers WHERE id = ?`)
      .get(id) as CustomerRow | undefined;

    if (!customer) throw new Error(`Customer ${id} not found after upsert`);

    const configRow = db
      .prepare(`SELECT value FROM app_config WHERE key = 'visits_per_tree'`)
      .get() as ConfigRow | undefined;

    if (!configRow) throw new Error('Config key visits_per_tree is missing from app_config');

    const visitsPerTree = parseVisitsPerTree(configRow.value);
    const treeEarned = customer.total_visits % visitsPerTree === 0;

    if (treeEarned) {
      db.prepare(`UPDATE customers SET trees_planted = trees_planted + 1 WHERE id = ?`).run(id);
    }

    return {
      customerId: id,
      totalVisits: customer.total_visits,
      treesPlanted: treeEarned ? customer.trees_planted + 1 : customer.trees_planted,
      treeEarned,
      lastSeen: toISO(customer.last_seen),
    };
  });

  return transaction(customerId);
}
