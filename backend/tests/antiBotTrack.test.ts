import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

vi.mock('../src/db/index', () => ({ getDb: () => db }));
vi.mock('../src/config', () => ({
  config: {
    port: 3000,
    visitsPerTree: 10,
    rapidFireMaxHits: 3,
    dbPath: ':memory:',
    nodeEnv: 'test',
    corsOrigins: ['http://localhost:5173'],
    adminSecret: '',
  },
}));

let db!: Database.Database;
let server: FastifyInstance;

const { runMigrations } = await import('../src/db/migrations');
const { buildServer } = await import('../src/server');
const { _resetBucketsForTest } = await import('../src/utils/rapidFire');

const REAL_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile Safari/604.1';

function track(customerId: string, ua = REAL_UA) {
  return server.inject({
    method: 'GET',
    url: `/api/v1/visits/track/${encodeURIComponent(customerId)}`,
    headers: { 'user-agent': ua },
  });
}

describe('anti-bot — track endpoint', () => {
  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations();
    server = await buildServer();
    _resetBucketsForTest();
  });

  afterEach(async () => {
    await server.close();
    await new Promise<void>((resolve) => setImmediate(resolve));
    db.close();
  });

  it('records a legitimate visit normally', async () => {
    const res = await track('real-device-001');
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ customerId: 'real-device-001', totalVisits: 1 });
  });

  it('returns 200 and does not store a honeypot ID', async () => {
    const res = await track('googlebot-probe');
    expect(res.statusCode).toBe(200);

    const check = await server.inject({ method: 'GET', url: '/api/v1/customers/googlebot-probe' });
    expect(check.statusCode).toBe(404);
  });

  it.each([
    'bot', 'crawler-007', 'spider', 'admin',
    'scan', 'test', 'root', 'tmp', 'temp',
  ])('silently drops honeypot ID "%s"', async (id) => {
    const res = await track(id);
    expect(res.statusCode).toBe(200);
  });

  it('returns 201 without storing a visit for a known bot user-agent', async () => {
    const res = await track('device-001', 'Mozilla/5.0 (compatible; Googlebot/2.1)');
    expect(res.statusCode).toBe(201);

    const check = await server.inject({ method: 'GET', url: '/api/v1/customers/device-001' });
    expect(check.statusCode).toBe(404);
  });

  it.each([
    ['curl', 'curl/7.88.1'],
    ['python-requests', 'python-requests/2.28.0'],
    ['Bingbot', 'Mozilla/5.0 (compatible; Bingbot/2.0)'],
    ['Go-http-client', 'Go-http-client/1.1'],
  ])('silently drops bot UA: %s', async (_label, ua) => {
    const res = await track('device-002', ua);
    expect(res.statusCode).toBe(201);

    const check = await server.inject({ method: 'GET', url: '/api/v1/customers/device-002' });
    expect(check.statusCode).toBe(404);
  });

  it('allows up to 3 visits then drops rapid-fire from same IP+ID', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await track('rapid-device');
      expect(res.statusCode).toBe(201);
    }

    const dropped = await track('rapid-device');
    expect(dropped.statusCode).toBe(200);

    // Customer has exactly 3 recorded visits, not 4
    const check = await server.inject({ method: 'GET', url: '/api/v1/customers/rapid-device' });
    expect(check.json()).toMatchObject({ totalVisits: 3 });
  });

  it('rapid-fire isolation: different IDs from same IP are independent', async () => {
    for (let i = 0; i < 3; i++) await track('id-A');

    // id-B has its own fresh bucket — should still succeed
    const res = await track('id-B');
    expect(res.statusCode).toBe(201);
  });
});
