import { getDb } from './index';

interface DemoCustomer {
  id: string;
  totalVisits: number;
  treesPlanted: number;
}

const DEMO_CUSTOMERS: DemoCustomer[] = [
  { id: 'device-store-01', totalVisits: 9,  treesPlanted: 0 }, // 1 away from first tree
  { id: 'device-store-02', totalVisits: 23, treesPlanted: 2 }, // 3 away from third
  { id: 'device-store-03', totalVisits: 15, treesPlanted: 1 }, // 5 away from second
  { id: 'device-store-04', totalVisits: 7,  treesPlanted: 0 },
  { id: 'device-store-05', totalVisits: 31, treesPlanted: 3 }, // 1 away from fourth tree!
  { id: 'device-store-06', totalVisits: 4,  treesPlanted: 0 },
  { id: 'device-store-07', totalVisits: 18, treesPlanted: 1 }, // 2 away from second
  { id: 'device-store-08', totalVisits: 12, treesPlanted: 1 }, // 8 away from second
];

function toSqlite(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// Distribute N timestamps quasi-randomly over the last 24 h, weighted
// toward business hours so the hourly chart looks realistic.
function generateTimestamps(count: number): string[] {
  const now = Date.now();
  const MS_PER_HOUR = 3_600_000;

  // Weight per hour-slot: slot 0 = 24 h ago, slot 23 = current hour.
  const weights = [
    0.3, 0.1, 0.1, 0.1, 0.2, 0.5,   // midnight–5 am  (very low)
    1.0, 2.5, 4.0, 5.0, 5.0, 4.5,   // 6 am–11 am     (morning ramp)
    3.5, 4.0, 5.0, 5.0, 4.0, 3.5,   // noon–5 pm      (afternoon peak)
    2.0, 1.5, 1.0, 0.7, 0.5, 0.3,   // 6 pm–11 pm     (evening wind-down)
  ];
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const timestamps: string[] = [];
  for (let i = 0; i < count; i++) {
    // Golden-ratio sequence avoids clustering while staying deterministic.
    const frac = ((i * 0.6180339887) % 1) * totalWeight;
    let slot = 0;
    let acc = 0;
    for (let h = 0; h < weights.length; h++) {
      acc += weights[h];
      if (acc >= frac) { slot = h; break; }
    }
    const hoursAgo = 23 - slot;
    const minuteOffset = (i * 7) % 60;
    const ts = new Date(now - hoursAgo * MS_PER_HOUR - minuteOffset * 60_000);
    timestamps.push(toSqlite(ts));
  }
  return timestamps.sort();
}

export function resetAndSeed(): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM visits').run();
    db.prepare('DELETE FROM customers').run();
  })();
  seedDemoData();
}

export function seedDemoData(): void {
  const db = getDb();
  const { count } = db
    .prepare('SELECT COUNT(*) as count FROM visits')
    .get() as { count: number };
  if (count > 0) return;

  const insertCustomer = db.prepare(`
    INSERT OR IGNORE INTO customers (id, total_visits, trees_planted, last_seen)
    VALUES (?, ?, ?, ?)
  `);
  const insertVisit = db.prepare(
    'INSERT INTO visits (customer_id, visited_at) VALUES (?, ?)',
  );

  const totalVisits = DEMO_CUSTOMERS.reduce((s, c) => s + c.totalVisits, 0);

  db.transaction(() => {
    for (const customer of DEMO_CUSTOMERS) {
      const timestamps = generateTimestamps(customer.totalVisits);
      insertCustomer.run(
        customer.id,
        customer.totalVisits,
        customer.treesPlanted,
        timestamps[timestamps.length - 1],
      );
      for (const ts of timestamps) {
        insertVisit.run(customer.id, ts);
      }
    }
  })();

  console.log(
    `[seed] ${DEMO_CUSTOMERS.length} demo customers, ${totalVisits} visits loaded`,
  );
}
