import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { existsSync } from 'fs';
import { join } from 'path';
import { config } from './config';
import { runMigrations } from './db/migrations';
import { seedDemoData, resetAndSeed } from './db/seed';
import { visitsRoutes } from './routes/visits';
import { customersRoutes } from './routes/customers';
import { configRoutes } from './routes/config';

export async function buildServer() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH'],
  });

  await fastify.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry in ${context.after}.`,
    }),
  });

  fastify.get('/health', { config: { rateLimit: false } }, async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });

  if (config.nodeEnv !== 'production') {
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'X Visits = 1 Tree API',
          description: 'Visit tracking service for Tree-Nation reforestation',
          version: '1.0.0',
        },
        tags: [
          { name: 'Visits', description: 'Visit recording and reporting' },
          { name: 'Customers', description: 'Customer lookup' },
          { name: 'Config', description: 'Runtime configuration' },
          { name: 'Stats', description: 'Aggregate statistics' },
        ],
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list' },
    });
  }

  await fastify.register(visitsRoutes);
  await fastify.register(customersRoutes);
  await fastify.register(configRoutes);

  // Serve bundled frontend when running as a single container (cloud deployment)
  const publicDir = join(__dirname, '..', 'public');
  if (existsSync(publicDir)) {
    await fastify.register(staticFiles, { root: publicDir, prefix: '/' });
    fastify.setNotFoundHandler((_request, reply) => {
      reply.sendFile('index.html');
    });
  }

  fastify.post('/api/v1/reset', async (_request, reply) => {
    resetAndSeed();
    return reply.send({ ok: true, message: 'Demo data reset successfully' });
  });

  fastify.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: 'Validation error', details: error.message });
    }
    fastify.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  });

  return fastify;
}

async function main() {
  runMigrations();
  seedDemoData();
  const fastify = await buildServer();

  const shutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
