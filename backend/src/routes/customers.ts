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
