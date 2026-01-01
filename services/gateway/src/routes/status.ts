import { Hono } from 'hono';
import type { GatewayBindings } from '../types.js';

export const registerStatusRoutes = (app: Hono<GatewayBindings>) => {
  app.get('/', (c) =>
    c.json({
      service: 'gateway',
      status: 'ok',
      environment: c.get('config').env,
      time: new Date().toISOString(),
    }),
  );

  app.get('/healthz', (c) =>
    c.json({
      status: 'ok',
      uptimeMs: Math.round(process.uptime() * 1000),
    }),
  );

  app.get('/readyz', async (c) => {
    const clients = c.get('services');
    const checks = await Promise.allSettled(
      (Object.keys(clients) as Array<keyof typeof clients>).map((key) =>
        clients[key].request({
          method: 'GET',
          path: '/healthz',
          timeoutMs: 250,
          parseJson: true,
        }),
      ),
    );

    const degraded = checks.filter((result) => result.status === 'rejected');
    const statusCode = degraded.length ? 503 : 200;

    return c.json(
      {
        status: degraded.length ? 'degraded' : 'ready',
        services: checks.map((result, index) => ({
          name: Object.keys(clients)[index],
          ok: result.status === 'fulfilled',
        })),
      },
      statusCode,
    );
  });
};
