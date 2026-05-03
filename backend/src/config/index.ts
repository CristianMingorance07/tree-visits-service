function parseIntEnv(name: string, fallback: string, min: number): number {
  const value = parseInt(process.env[name] ?? fallback, 10);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const adminSecret = process.env.ADMIN_SECRET ?? '';

if (nodeEnv === 'production' && !adminSecret) {
  throw new Error('ADMIN_SECRET is required when NODE_ENV=production');
}

export const config = {
  port: parseIntEnv('PORT', '3000', 1),
  visitsPerTree: parseIntEnv('VISITS_PER_TREE', '10', 1),
  dbPath: process.env.DB_PATH ?? './data/visits.db',
  nodeEnv,
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((s) => s.trim()),
  adminSecret,
} as const;
