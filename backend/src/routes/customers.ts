import { FastifyInstance } from 'fastify';
import { getDb } from '../db';
import { toISO } from '../utils/date';

interface CustomerParams {
  customerId: string;
}

interface CustomerRow {
  id: string;
  total_visits: number;
  trees_planted: number;
  last_seen: string;
}

interface ConfigRow {
  value: string;
}

export async function customersRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/v1/customers',
    {
      schema: {
        tags: ['Customers'],
        summary: 'List all customers sorted by trees planted then closest to next tree',
        response: {
          200: {
            type: 'object',
            properties: {
              customers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    customerId: { type: 'string' },
                    totalVisits: { type: 'integer' },
                    treesPlanted: { type: 'integer' },
                    lastSeen: { type: 'string' },
                    visitsUntilNextTree: { type: 'integer' },
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

      const configRow = db
        .prepare(`SELECT value FROM app_config WHERE key = 'visits_per_tree'`)
        .get() as ConfigRow | undefined;

      if (!configRow) return reply.status(500).send({ error: 'Internal server error' });

      const visitsPerTree = parseInt(configRow.value, 10);

      const rows = db
        .prepare(`SELECT id, total_visits, trees_planted, last_seen FROM customers ORDER BY trees_planted DESC, total_visits DESC`)
        .all() as CustomerRow[];

      const customers = rows.map(c => {
        const mod = c.total_visits % visitsPerTree;
        return {
          customerId: c.id,
          totalVisits: c.total_visits,
          treesPlanted: c.trees_planted,
          lastSeen: toISO(c.last_seen),
          visitsUntilNextTree: mod === 0 ? visitsPerTree : visitsPerTree - mod,
        };
      });

      customers.sort((a, b) =>
        b.treesPlanted - a.treesPlanted || a.visitsUntilNextTree - b.visitsUntilNextTree,
      );

      return reply.send({ customers });
    },
  );

  fastify.get<{ Params: CustomerParams }>(
    '/api/v1/customers/:customerId',
    {
      schema: {
        tags: ['Customers'],
        summary: 'Get stats for a specific customer',
        params: {
          type: 'object',
          properties: {
            customerId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              customerId: { type: 'string' },
              totalVisits: { type: 'integer' },
              treesPlanted: { type: 'integer' },
              lastSeen: { type: 'string' },
              visitsUntilNextTree: { type: 'integer' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { customerId } = request.params;
      const db = getDb();

      const customer = db
        .prepare(`SELECT id, total_visits, trees_planted, last_seen FROM customers WHERE id = ?`)
        .get(customerId) as CustomerRow | undefined;

      if (!customer) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      const configRow = db
        .prepare(`SELECT value FROM app_config WHERE key = 'visits_per_tree'`)
        .get() as ConfigRow | undefined;

      if (!configRow) {
        return reply.status(500).send({ error: 'Internal server error' });
      }

      const visitsPerTree = parseInt(configRow.value, 10);
      const visitsUntilNextTree = visitsPerTree - (customer.total_visits % visitsPerTree);

      return reply.send({
        customerId: customer.id,
        totalVisits: customer.total_visits,
        treesPlanted: customer.trees_planted,
        lastSeen: toISO(customer.last_seen),
        visitsUntilNextTree,
      });
    }
  );
}
