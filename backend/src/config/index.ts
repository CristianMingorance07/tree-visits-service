export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  visitsPerTree: parseInt(process.env.VISITS_PER_TREE ?? '10', 10),
  dbPath: process.env.DB_PATH ?? './data/visits.db',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((s) => s.trim()),
  adminSecret: process.env.ADMIN_SECRET ?? '',
} as const;
