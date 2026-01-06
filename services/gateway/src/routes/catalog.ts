import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { GatewayBindings } from '../types.js';
import { callService, requestQueries } from './helpers.js';
import { requireAuth } from '../middleware/auth.js';

export const registerCatalogRoutes = (app: Hono<GatewayBindings>) => {
  app.get('/products', async (c) => {
    const { data } = await callService<unknown>(c, 'catalog', {
      method: 'GET',
      path: 'api/catalog/products',
      searchParams: requestQueries(c),
      forwardAuth: false,
    });

    return c.json(data);
  });

  app.get('/products/:id', async (c) => {
    const { data } = await callService<unknown>(c, 'catalog', {
      method: 'GET',
      path: `api/catalog/products/${c.req.param('id')}`,
    });

    return c.json(data);
  });

  app.post('/products', requireAuth({ roles: ['admin'] }), async (c) => {
    const { data, status } = await callService<unknown>(c, 'catalog', {
      method: 'POST',
      path: 'api/catalog/products',
      json: await c.req.json(),
      forwardAuth: true,
      forwardIdempotencyKey: true,
    });

    return c.json(data, status as ContentfulStatusCode);
  });
};
