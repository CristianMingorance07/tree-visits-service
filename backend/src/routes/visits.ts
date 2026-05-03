import { FastifyInstance } from 'fastify';
import { registerVisit, enrichVisit } from '../services/visitService';
import { getDb } from '../db';
import { toISO } from '../utils/date';
import { lookupGeo, parseLanguage } from '../utils/geo';

interface TrackParams { customerId: string; }
interface ConfigRow { value: string; }
interface PostVisitBody { customerId: string; }
interface HourlyRow { hour: string; count: number; }
interface StatsRow { totalTreesPlanted: number; totalCustomers: number; totalVisits: number; }
interface ChartQuerystring { range?: string; filter?: string; }
interface ChartRow { label: string; count: number; }
interface LiveTreesRow { realTrees: number; }
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

const CUSTOMER_ID_SCHEMA = {
  type: 'string',
  minLength: 1,
  maxLength: 100,
  pattern: '^[a-zA-Z0-9_\\-.]+$',
} as const;

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
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['Visits'],
        summary: 'Record a visit event from a device',
        body: {
          type: 'object',
          required: ['customerId'],
          properties: {
            customerId: CUSTOMER_ID_SCHEMA,
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

  fastify.get<{ Params: TrackParams }>(
    '/api/v1/visits/track/:customerId',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        tags: ['Visits'],
        summary: 'Record a visit via public tracking link — returns visit result as JSON',
        params: {
          type: 'object',
          required: ['customerId'],
          properties: {
            customerId: CUSTOMER_ID_SCHEMA,
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
        try {
          const geo = await lookupGeo(ip);
          enrichVisit(visitId, {
            country: geo?.country ?? null,
            countryCode: geo?.countryCode ?? null,
            city: geo?.city ?? null,
            language: parseLanguage(acceptLang),
          });
        } catch (err) {
          request.log.warn({ err, visitId }, 'Failed to enrich tracked visit');
        }
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

  fastify.get<{ Querystring: { filter?: string } }>(
    '/api/v1/visits/recent',
    {
      schema: {
        tags: ['Visits'],
        summary: 'Recent visits — filter=real (tracking links) or filter=demo (simulator devices)',
        querystring: {
          type: 'object',
          properties: { filter: { type: 'string', enum: ['real', 'demo'] } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              visits: {
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
    async (request, reply) => {
      const db = getDb();
      const filter = request.query.filter ?? 'real';

      if (filter === 'demo') {
        const DEMO_INFO: Record<string, { type: string; name: string }> = {
          'device-store-01': { type: 'mobile',  name: 'Mobile A' },
          'device-store-02': { type: 'mobile',  name: 'Mobile C' },
          'device-store-03': { type: 'mobile',  name: 'Mobile B' },
          'device-store-05': { type: 'tablet',  name: 'Tablet A' },
          'device-store-07': { type: 'desktop', name: 'Desktop A' },
          'device-store-08': { type: 'desktop', name: 'Desktop B' },
        };
        interface DemoRow { id: number; customer_id: string; visited_at: string; }
        const rows = db.prepare(
          `SELECT id, customer_id, visited_at FROM visits
           WHERE customer_id LIKE 'device-store-%'
           ORDER BY visited_at DESC LIMIT 100`,
        ).all() as DemoRow[];
        return reply.send({
          visits: rows.map(r => {
            const info = DEMO_INFO[r.customer_id] ?? { type: 'desktop', name: r.customer_id };
            return {
              id: r.id,
              customerId: r.customer_id,
              visitedAt: toISO(r.visited_at),
              device: { type: info.type, os: 'Simulator', browser: 'Demo', brand: info.name },
              country: null, countryCode: null, city: null, language: null,
            };
          }),
        });
      }

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
        visits: rows.map(r => ({
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
        summary: 'Statistics for real tracking-link visits only (user_agent present)',
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
      const realVisits24h = (db.prepare(
        `SELECT COUNT(*) as cnt FROM visits WHERE user_agent IS NOT NULL AND visited_at >= datetime('now', '-24 hours')`,
      ).get() as { cnt: number }).cnt;

      const perDevice = db.prepare(
        `SELECT COUNT(*) as cnt FROM visits WHERE user_agent IS NOT NULL GROUP BY customer_id`,
      ).all() as { cnt: number }[];

      const realDevices = perDevice.length;
      const { realTrees } = db.prepare(`
        SELECT COALESCE(SUM(c.trees_planted), 0) as realTrees
        FROM customers c
        WHERE EXISTS (
          SELECT 1 FROM visits v
          WHERE v.customer_id = c.id AND v.user_agent IS NOT NULL
        )
      `).get() as LiveTreesRow;

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
