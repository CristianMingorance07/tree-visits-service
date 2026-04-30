import { FastifyInstance } from 'fastify';
import { registerVisit } from '../services/visitService';
import { getDb } from '../db';

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
