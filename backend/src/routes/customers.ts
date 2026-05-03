import { FastifyInstance } from 'fastify';
import { toISO } from '../utils/date';
import { getVisitsPerTree } from '../repositories/configRepository';
import { getCustomerById, listCustomers } from '../repositories/customerRepository';

interface CustomerParams {
  customerId: string;
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
      const visitsPerTree = getVisitsPerTree();
      const rows = listCustomers();

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
      const customer = getCustomerById(customerId);

      if (!customer) {
        return reply.status(404).send({ error: 'Customer not found' });
      }

      const visitsPerTree = getVisitsPerTree();
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
