import { FastifyInstance } from 'fastify';
import { registerVisit } from '../services/visitService';
import { getDb } from '../db';

interface ScanParams {
  customerId: string;
}

interface ConfigRow {
  value: string;
}

interface PostVisitBody {
  customerId: string;
}

interface HourlyRow {
  hour: string;
  count: number;
}

interface StatsRow {
  totalTreesPlanted: number;
  totalCustomers: number;
  totalVisits: number;
}

export async function visitsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: PostVisitBody }>(
    '/api/v1/visits',
    {
      schema: {
        tags: ['Visits'],
        summary: 'Record a visit event from a device',
        body: {
          type: 'object',
          required: ['customerId'],
          properties: {
            customerId: { type: 'string', minLength: 1, maxLength: 100 },
          },
          additionalProperties: false,
        },
        response: {
          201: {
            type: 'object',
            properties: {
              customerId: { type: 'string' },
              totalVisits: { type: 'integer' },
              treesPlanted: { type: 'integer' },
              treeEarned: { type: 'boolean' },
              lastSeen: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = registerVisit(request.body.customerId);
      return reply.status(201).send(result);
    }
  );

  fastify.get<{ Params: ScanParams }>(
    '/api/v1/visits/scan/:customerId',
    { schema: { tags: ['Visits'], summary: 'Record a visit via GET (for QR code scanning)' } },
    async (request, reply) => {
      const { customerId } = request.params;
      const result = registerVisit(customerId);

      const db = getDb();
      const cfg = db.prepare(`SELECT value FROM app_config WHERE key = 'visits_per_tree'`).get() as ConfigRow;
      const visitsPerTree = parseInt(cfg.value, 10);
      const mod = result.totalVisits % visitsPerTree;
      const visitsUntilNext = mod === 0 ? visitsPerTree : visitsPerTree - mod;
      const pct = Math.round(((visitsPerTree - visitsUntilNext) / visitsPerTree) * 100);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${result.treeEarned ? 'Tree Planted!' : 'Visit Recorded'} · Tree-Nation</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8faf9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:24px;padding:40px 28px;text-align:center;max-width:340px;width:100%;box-shadow:0 4px 32px rgba(0,0,0,.07)}
    .icon{width:72px;height:72px;background:${result.treeEarned ? '#3aaa68' : '#f3f4f6'};border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px}
    h1{font-size:22px;font-weight:800;color:#111827;margin-bottom:6px}
    .device{color:#9ca3af;font-size:12px;margin-bottom:24px;font-family:monospace;background:#f3f4f6;padding:6px 12px;border-radius:8px;display:inline-block}
    .banner{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;margin-bottom:20px;font-size:14px;color:#3aaa68;font-weight:700}
    .stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
    .stat{background:#f8faf9;border:1px solid #e5e7eb;border-radius:12px;padding:16px 10px}
    .stat-v{font-size:30px;font-weight:900;color:#111827}
    .stat-v.green{color:#3aaa68}
    .stat-l{font-size:11px;color:#9ca3af;margin-top:2px}
    .bar-wrap{height:6px;background:#e5e7eb;border-radius:99px;overflow:hidden;margin-bottom:8px}
    .bar-fill{height:100%;background:#3aaa68;border-radius:99px;width:${pct}%}
    .bar-label{font-size:11px;color:#9ca3af;margin-bottom:24px}
    a{display:block;color:#3aaa68;font-size:13px;font-weight:600;text-decoration:none;border:1px solid #d1fae5;border-radius:10px;padding:10px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${result.treeEarned ? '🌳' : '✅'}</div>
    <h1>${result.treeEarned ? 'Tree Planted!' : 'Visit Recorded'}</h1>
    <div class="device">${customerId}</div>
    ${result.treeEarned ? `<div class="banner">🎉 A new tree has been planted for this customer!</div>` : ''}
    <div class="stats">
      <div class="stat"><div class="stat-v">${result.totalVisits}</div><div class="stat-l">Total visits</div></div>
      <div class="stat"><div class="stat-v green">${result.treesPlanted}</div><div class="stat-l">Trees planted</div></div>
    </div>
    <div class="bar-wrap"><div class="bar-fill"></div></div>
    <div class="bar-label">${visitsUntilNext} more visit${visitsUntilNext !== 1 ? 's' : ''} to plant the next tree</div>
    <a href="/">← Back to dashboard</a>
  </div>
</body>
</html>`;

      return reply.type('text/html').send(html);
    },
  );

  fastify.get(
    '/api/v1/visits/hourly',
    {
      schema: {
        tags: ['Visits'],
        summary: 'Visit counts aggregated per hour for the last 24 hours',
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    hour: { type: 'string' },
                    count: { type: 'number' },
                  },
                },
              },
              totalVisits24h: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();

      const rows = db
        .prepare(
          `SELECT
            strftime('%Y-%m-%dT%H:00:00.000Z', visited_at) as hour,
            COUNT(*) as count
          FROM visits
          WHERE visited_at >= datetime('now', '-24 hours')
          GROUP BY strftime('%Y-%m-%dT%H', visited_at)
          ORDER BY hour ASC`
        )
        .all() as HourlyRow[];

      const totalVisits24h = rows.reduce((sum, row) => sum + row.count, 0);

      return reply.send({ data: rows, totalVisits24h });
    }
  );

  fastify.get(
    '/api/v1/stats',
    {
      schema: {
        tags: ['Stats'],
        summary: 'Aggregate statistics across all customers',
        response: {
          200: {
            type: 'object',
            properties: {
              totalTreesPlanted: { type: 'number' },
              totalCustomers: { type: 'number' },
              totalVisits: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();

      const stats = db
        .prepare(
          `SELECT
            COALESCE(SUM(trees_planted), 0) as totalTreesPlanted,
            COUNT(*) as totalCustomers,
            COALESCE(SUM(total_visits), 0) as totalVisits
          FROM customers`
        )
        .get() as StatsRow;

      return reply.send(stats);
    }
  );
}
