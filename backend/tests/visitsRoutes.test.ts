import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

let db!: Database.Database;
let server: FastifyInstance;

vi.mock('../src/db/index', () => ({
  getDb: () => db,
}));

const { runMigrations } = await import('../src/db/migrations');
const { buildServer } = await import('../src/server');

describe('visits routes', () => {
  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations();
    server = await buildServer();
  });

  afterEach(async () => {
    await server.close();
    await new Promise<void>((resolve) => setImmediate(resolve));
    db.close();
  });

  it('records a visit through the public tracking endpoint', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/visits/track/device-route-001',
      headers: { 'user-agent': 'Mozilla/5.0 Test Browser' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      customerId: 'device-route-001',
      totalVisits: 1,
      treesPlanted: 0,
      treeEarned: false,
      visitsUntilNextTree: 9,
      visitsPerTree: 10,
    });
  });

  it('rejects invalid public tracking ids', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/visits/track/bad%20id',
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns recent tracked visits under visits', async () => {
    await server.inject({
      method: 'GET',
      url: '/api/v1/visits/track/device-route-002',
      headers: { 'user-agent': 'Mozilla/5.0 Test Browser' },
    });

    const res = await server.inject({ method: 'GET', url: '/api/v1/visits/recent?filter=real' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      visits: [
        {
          customerId: 'device-route-002',
          device: { type: 'desktop', browser: 'Unknown' },
        },
      ],
    });
  });
});
