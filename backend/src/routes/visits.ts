import { FastifyInstance } from 'fastify';
import { registerVisit, enrichVisit } from '../services/visitService';
import { getDb } from '../db';
import { toISO } from '../utils/date';
import { lookupGeo, parseLanguage } from '../utils/geo';

interface ScanParams { customerId: string; }
interface ConfigRow { value: string; }
interface PostVisitBody { customerId: string; }
interface HourlyRow { hour: string; count: number; }
interface StatsRow { totalTreesPlanted: number; totalCustomers: number; totalVisits: number; }
interface ChartQuerystring { range?: string; filter?: string; }
interface ChartRow { label: string; count: number; }
interface RecentRow {
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

function parseUA(ua: string): { type: string; os: string; browser: string; brand: string | null } {
  const type =
    /tablet|ipad/i.test(ua) ? 'tablet' :
    /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop';

  const os =
    /iphone|ipad/i.test(ua) ? 'iOS' :
    /android/i.test(ua) ? 'Android' :
    /windows nt/i.test(ua) ? 'Windows' :
    /mac os x|macos/i.test(ua) ? 'macOS' :
    /linux/i.test(ua) ? 'Linux' : 'Unknown';

  const browser =
    /edg\//i.test(ua) ? 'Edge' :
    /opr|opera/i.test(ua) ? 'Opera' :
    /firefox/i.test(ua) ? 'Firefox' :
    /chrome/i.test(ua) ? 'Chrome' :
    /safari/i.test(ua) ? 'Safari' : 'Unknown';

  const brand =
    /iphone|ipad/i.test(ua) ? 'Apple' :
    /samsung/i.test(ua) ? 'Samsung' :
    /xiaomi|miui/i.test(ua) ? 'Xiaomi' :
    /huawei/i.test(ua) ? 'Huawei' :
    /pixel/i.test(ua) ? 'Google' :
    /oppo/i.test(ua) ? 'OPPO' :
    /oneplus/i.test(ua) ? 'OnePlus' :
    /motorola/i.test(ua) ? 'Motorola' : null;

  return { type, os, browser, brand };
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
    },
  );

  fastify.get<{ Params: ScanParams }>(
    '/api/v1/visits/scan/:customerId',
    {
      schema: {
        tags: ['Visits'],
        summary: 'Record a visit via QR scan — returns visit result as JSON',
        response: {
          201: {
            type: 'object',
            properties: {
              customerId: { type: 'string' },
              totalVisits: { type: 'integer' },
              treesPlanted: { type: 'integer' },
              treeEarned: { type: 'boolean' },
              lastSeen: { type: 'string' },
              visitsUntilNextTree: { type: 'integer' },
              visitsPerTree: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { customerId } = request.params;
      const ua = request.headers['user-agent'] ?? '';
      const ip = (request.headers['x-real-ip'] as string)
        ?? (request.headers['x-forwarded-for'] as string)?.split(',')[0]
        ?? request.ip;

      const result = registerVisit(customerId, { userAgent: ua || undefined, ip: ip || undefined });

      const db = getDb();
      const cfg = db.prepare(`SELECT value FROM app_config WHERE key = 'visits_per_tree'`).get() as ConfigRow;
      const visitsPerTree = parseInt(cfg.value, 10);
      const mod = result.totalVisits % visitsPerTree;
      const visitsUntilNextTree = mod === 0 ? visitsPerTree : visitsPerTree - mod;

      // Enrich with geo + language asynchronously — never blocks the response
      const visitId = result.visitId;
      const acceptLang = (request.headers['accept-language'] as string) ?? '';
      setImmediate(async () => {
        const [geo] = await Promise.all([lookupGeo(ip)]);
        enrichVisit(visitId, {
          country: geo?.country ?? null,
          countryCode: geo?.countryCode ?? null,
          city: geo?.city ?? null,
          language: parseLanguage(acceptLang),
        });
      });

      return reply.status(201).send({
        customerId,
        totalVisits: result.totalVisits,
        treesPlanted: result.treesPlanted,
        treeEarned: result.treeEarned,
        lastSeen: result.lastSeen,
        visitsUntilNextTree,
        visitsPerTree,
      });
    },
  );

  fastify.get(
    '/api/v1/visits/recent',
    {
      schema: {
        tags: ['Visits'],
        summary: 'Last 20 visits recorded via QR scan (with device info)',
        response: {
          200: {
            type: 'object',
            properties: {
              scans: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    customerId: { type: 'string' },
                    visitedAt: { type: 'string' },
                    device: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        os: { type: 'string' },
                        browser: { type: 'string' },
                        brand: { type: ['string', 'null'] },
                      },
                    },
                    country: { type: ['string', 'null'] },
                    countryCode: { type: ['string', 'null'] },
                    city: { type: ['string', 'null'] },
                    language: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();
      const rows = db
        .prepare(
          `SELECT id, customer_id, visited_at, user_agent, ip,
                  country, country_code, city, language
           FROM visits
           WHERE user_agent IS NOT NULL
           ORDER BY visited_at DESC
           LIMIT 100`,
        )
        .all() as RecentRow[];

      return reply.send({
        scans: rows.map(r => ({
          id: r.id,
          customerId: r.customer_id,
          visitedAt: toISO(r.visited_at),
          device: parseUA(r.user_agent ?? ''),
          country: r.country,
          countryCode: r.country_code,
          city: r.city,
          language: r.language,
        })),
      });
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
          ORDER BY hour ASC`,
        )
        .all() as HourlyRow[];
      return reply.send({ data: rows, totalVisits24h: rows.reduce((s, r) => s + r.count, 0) });
    },
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
          FROM customers`,
        )
        .get() as StatsRow;
      return reply.send(stats);
    },
  );

  fastify.get(
    '/api/v1/stats/live',
    {
      schema: {
        tags: ['Stats'],
        summary: 'Statistics for real QR scan visits only (user_agent present)',
        response: {
          200: {
            type: 'object',
            properties: {
              realVisits24h: { type: 'number' },
              realDevices: { type: 'number' },
              realTrees: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const db = getDb();
      const cfg = db.prepare(`SELECT value FROM app_config WHERE key = 'visits_per_tree'`).get() as ConfigRow;
      const visitsPerTree = parseInt(cfg.value, 10);

      const realVisits24h = (db.prepare(
        `SELECT COUNT(*) as cnt FROM visits WHERE user_agent IS NOT NULL AND visited_at >= datetime('now', '-24 hours')`,
      ).get() as { cnt: number }).cnt;

      const perDevice = db.prepare(
        `SELECT COUNT(*) as cnt FROM visits WHERE user_agent IS NOT NULL GROUP BY customer_id`,
      ).all() as { cnt: number }[];

      const realDevices = perDevice.length;
      const realTrees = perDevice.reduce((sum, r) => sum + Math.floor(r.cnt / visitsPerTree), 0);

      return reply.send({ realVisits24h, realDevices, realTrees });
    },
  );

  fastify.get<{ Querystring: ChartQuerystring }>(
    '/api/v1/visits/chart',
    {
      schema: {
        tags: ['Visits'],
        summary: 'Visit activity for charting — configurable range (24h/7d/30d) and filter (all/real)',
        querystring: {
          type: 'object',
          properties: {
            range:  { type: 'string', enum: ['24h', '7d', '30d'] },
            filter: { type: 'string', enum: ['all', 'real'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    count: { type: 'number' },
                  },
                },
              },
              total:       { type: 'number' },
              granularity: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const range  = request.query.range  ?? '24h';
      const filter = request.query.filter ?? 'all';
      const db     = getDb();
      const realOnly = filter === 'real' ? 'AND user_agent IS NOT NULL' : '';
      let rows: ChartRow[];
      let granularity: 'hour' | 'day';

      if (range === '24h') {
        granularity = 'hour';
        rows = db.prepare(`
          SELECT strftime('%Y-%m-%dT%H:00:00.000Z', visited_at) AS label,
                 COUNT(*) AS count
          FROM visits
          WHERE visited_at >= datetime('now', '-24 hours') ${realOnly}
          GROUP BY strftime('%Y-%m-%dT%H', visited_at)
          ORDER BY label ASC
        `).all() as ChartRow[];
      } else {
        granularity = 'day';
        const days = range === '7d' ? 7 : 30;
        const since = new Date();
        since.setDate(since.getDate() - days + 1);
        const sinceStr = since.toISOString().slice(0, 10);
        rows = db.prepare(`
          SELECT date(visited_at) AS label, COUNT(*) AS count
          FROM visits
          WHERE date(visited_at) >= ? ${realOnly}
          GROUP BY date(visited_at)
          ORDER BY label ASC
        `).all(sinceStr) as ChartRow[];
      }

      const total = rows.reduce((s, r) => s + r.count, 0);
      return reply.send({ data: rows, total, granularity });
    },
  );
}
