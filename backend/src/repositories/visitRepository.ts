import Database from 'better-sqlite3';
import { getDb } from '../db';

export interface VisitMeta {
  userAgent?: string;
  ip?: string;
}

export interface GeoEnrichment {
  country: string | null;
  countryCode: string | null;
  city: string | null;
  language: string | null;
}

export interface RecentVisitRow {
  id: number;
  customer_id: string;
  visited_at: string;
  user_agent: string | null;
  ip: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  language: string | null;
}

export interface DemoVisitRow {
  id: number;
  customer_id: string;
  visited_at: string;
}

export interface HourlyRow {
  hour: string;
  count: number;
}

export interface ChartRow {
  label: string;
  count: number;
}

export type ChartRange = '24h' | '7d' | '30d';
export type ChartFilter = 'all' | 'real';
export type ChartGranularity = 'hour' | 'day';

export function insertVisit(
  customerId: string,
  meta: VisitMeta | undefined,
  db: Database.Database,
): number {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO visits (customer_id, visited_at, user_agent, ip) VALUES (?, datetime('now'), ?, ?)`,
  ).run(customerId, meta?.userAgent ?? null, meta?.ip ?? null);

  return Number(lastInsertRowid);
}

export function enrichVisit(visitId: number, data: GeoEnrichment, db: Database.Database = getDb()): void {
  db.prepare(
    `UPDATE visits SET country = ?, country_code = ?, city = ?, language = ? WHERE id = ?`,
  ).run(data.country, data.countryCode, data.city, data.language, visitId);
}

export function listDemoVisits(db: Database.Database = getDb()): DemoVisitRow[] {
  return db.prepare(
    `SELECT id, customer_id, visited_at FROM visits
     WHERE customer_id LIKE 'device-store-%'
     ORDER BY visited_at DESC LIMIT 100`,
  ).all() as DemoVisitRow[];
}

export function listTrackedVisits(db: Database.Database = getDb()): RecentVisitRow[] {
  return db
    .prepare(
      `SELECT id, customer_id, visited_at, user_agent, ip,
              country, country_code, city, language
       FROM visits
       WHERE user_agent IS NOT NULL
       ORDER BY visited_at DESC
       LIMIT 100`,
    )
    .all() as RecentVisitRow[];
}

export function listHourlyVisitCounts(db: Database.Database = getDb()): HourlyRow[] {
  return db
    .prepare(
      `SELECT
        strftime('%Y-%m-%dT%H:00:00.000Z', visited_at) as hour,
        COUNT(*) as count
      FROM visits
      WHERE visited_at >= datetime('now', '-24 hours')
      GROUP BY strftime('%Y-%m-%dT%H', visited_at)
      ORDER BY hour ASC`,
    )
    .all() as HourlyRow[];
}

export function countTrackedVisits24h(db: Database.Database = getDb()): number {
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM visits WHERE user_agent IS NOT NULL AND visited_at >= datetime('now', '-24 hours')`,
  ).get() as { count: number };

  return row.count;
}

export function countTrackedDevices(db: Database.Database = getDb()): number {
  const row = db.prepare(
    `SELECT COUNT(DISTINCT customer_id) as count FROM visits WHERE user_agent IS NOT NULL`,
  ).get() as { count: number };

  return row.count;
}

export function listChartRows(
  range: ChartRange,
  filter: ChartFilter,
  db: Database.Database = getDb(),
): { rows: ChartRow[]; granularity: ChartGranularity } {
  const realOnly = filter === 'real' ? 'AND user_agent IS NOT NULL' : '';

  if (range === '24h') {
    return {
      granularity: 'hour',
      rows: db.prepare(`
        SELECT strftime('%Y-%m-%dT%H:00:00.000Z', visited_at) AS label,
               COUNT(*) AS count
        FROM visits
        WHERE visited_at >= datetime('now', '-24 hours') ${realOnly}
        GROUP BY strftime('%Y-%m-%dT%H', visited_at)
        ORDER BY label ASC
      `).all() as ChartRow[],
    };
  }

  const days = range === '7d' ? 7 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  const sinceStr = since.toISOString().slice(0, 10);

  return {
    granularity: 'day',
    rows: db.prepare(`
      SELECT date(visited_at) AS label, COUNT(*) AS count
      FROM visits
      WHERE date(visited_at) >= ? ${realOnly}
      GROUP BY date(visited_at)
      ORDER BY label ASC
    `).all(sinceStr) as ChartRow[],
  };
}
