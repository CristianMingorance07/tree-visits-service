import { FastifyInstance } from 'fastify';
import { config } from '../config';
import { getVisitsPerTree, updateVisitsPerTree } from '../repositories/configRepository';

interface PatchConfigBody {
  visitsPerTree: number;
}

export async function configRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/v1/config',
    {
      schema: {
        tags: ['Config'],
        summary: 'Get current visits-per-tree configuration',
        response: {
          200: {
            type: 'object',
            properties: {
              visitsPerTree: { type: 'integer' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send({ visitsPerTree: getVisitsPerTree() });
    }
  );

  fastify.patch<{ Body: PatchConfigBody }>(
    '/api/v1/config',
    {
      schema: {
        tags: ['Config'],
        summary: 'Update visits-per-tree at runtime (no restart needed)',
        body: {
          type: 'object',
          required: ['visitsPerTree'],
          properties: {
            visitsPerTree: { type: 'integer', minimum: 1, maximum: 1000 },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              visitsPerTree: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (config.adminSecret) {
        const provided = request.headers['x-admin-secret'];
        if (provided !== config.adminSecret) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
      }
      const { visitsPerTree } = request.body;
      updateVisitsPerTree(visitsPerTree);
      return reply.send({ visitsPerTree });
    }
  );
}
