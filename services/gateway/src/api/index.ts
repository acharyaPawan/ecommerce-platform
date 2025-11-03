import type { Hono } from 'hono';

const SERVICE_NAME = 'gateway';

export function registerRoutes(app: Hono) {
  app.get('/', (c) => c.json({ service: SERVICE_NAME, status: 'ok' }));
  app.get('/healthz', (c) => c.json({ status: 'healthy' }));
  app.get('/readyz', (c) => c.json({ status: 'ready' }));
}
