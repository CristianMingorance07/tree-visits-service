import { FastifyInstance } from 'fastify';
import { getDb } from '../db';

interface PatchConfigBody {
  visitsPerTree: number;
}

interface ConfigRow {
  value: string;
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
      const db = getDb();
      const row = db
        .prepare(`SELECT value FROM app_config WHERE key = 'visits_per_tree'`)
        .get() as ConfigRow;
      return reply.send({ visitsPerTree: parseInt(row.value, 10) });
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
      const { visitsPerTree } = request.body;
      const db = getDb();
      db.prepare(`UPDATE app_config SET value = ? WHERE key = 'visits_per_tree'`).run(
        String(visitsPerTree)
      );
      return reply.send({ visitsPerTree });
    }
  );
}
