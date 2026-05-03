import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

const testConfig = vi.hoisted(() => ({
  adminSecret: 'test-admin-secret',
}));

let db!: Database.Database;
let server: FastifyInstance;

vi.mock('../src/db/index', () => ({
  getDb: () => db,
}));

vi.mock('../src/config', () => ({
  config: {
    port: 3000,
    visitsPerTree: 10,
    rapidFireMaxHits: 3,
    dbPath: ':memory:',
    nodeEnv: 'test',
    corsOrigins: ['http://localhost:5173'],
    get adminSecret() {
      return testConfig.adminSecret;
    },
  },
}));

const { runMigrations } = await import('../src/db/migrations');
const { buildServer } = await import('../src/server');

describe('admin routes', () => {
  beforeEach(async () => {
    testConfig.adminSecret = 'test-admin-secret';
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

  it('keeps config reads public', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/v1/config' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ visitsPerTree: 10 });
  });

  it('rejects config updates without the admin secret', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/config',
      payload: { visitsPerTree: 5 },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Unauthorized' });

    const unchanged = await server.inject({ method: 'GET', url: '/api/v1/config' });
    expect(unchanged.json()).toEqual({ visitsPerTree: 10 });
  });

  it('rejects config updates with the wrong admin secret', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/config',
      headers: { 'x-admin-secret': 'wrong-secret' },
      payload: { visitsPerTree: 5 },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('updates config with the admin secret', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/v1/config',
      headers: { 'x-admin-secret': 'test-admin-secret' },
      payload: { visitsPerTree: 5 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ visitsPerTree: 5 });

    const updated = await server.inject({ method: 'GET', url: '/api/v1/config' });
    expect(updated.json()).toEqual({ visitsPerTree: 5 });
  });

  it('rejects reset without the admin secret', async () => {
    await server.inject({ method: 'GET', url: '/api/v1/visits/track/live-device-001' });

    const res = await server.inject({ method: 'POST', url: '/api/v1/reset' });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Unauthorized' });

    const liveCustomer = await server.inject({
      method: 'GET',
      url: '/api/v1/customers/live-device-001',
    });
    expect(liveCustomer.statusCode).toBe(200);
  });

  it('rejects reset with the wrong admin secret', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/reset',
      headers: { 'x-admin-secret': 'wrong-secret' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('preserves client errors for unsupported reset content types', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/reset',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: '',
    });

    expect(res.statusCode).toBe(415);
    expect(res.json()).toMatchObject({ error: expect.stringContaining('Unsupported Media Type') });
  });

  it('resets live data and reloads seeded demo data with the admin secret', async () => {
    await server.inject({ method: 'GET', url: '/api/v1/visits/track/live-device-002' });

    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/reset',
      headers: { 'x-admin-secret': 'test-admin-secret' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, message: 'Demo data reset successfully' });

    const liveCustomer = await server.inject({
      method: 'GET',
      url: '/api/v1/customers/live-device-002',
    });
    expect(liveCustomer.statusCode).toBe(404);

    const demoCustomer = await server.inject({
      method: 'GET',
      url: '/api/v1/customers/device-store-01',
    });
    expect(demoCustomer.statusCode).toBe(200);
    expect(demoCustomer.json()).toMatchObject({
      customerId: 'device-store-01',
      totalVisits: 9,
      treesPlanted: 0,
    });
  });
});
