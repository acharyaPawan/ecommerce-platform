import { Hono } from 'hono';
import type { GatewayBindings } from '../types.js';
import { callService, requestQueries } from './helpers.js';

export const registerCatalogRoutes = (app: Hono<GatewayBindings>) => {
  app.get('/products', async (c) => {
    const { data } = await callService<unknown>(c, 'catalog', {
      method: 'GET',
      path: '/products',
      searchParams: requestQueries(c),
      forwardAuth: false,
    });

    return c.json(data);
  });

  app.get('/products/:id', async (c) => {
    const { data } = await callService<unknown>(c, 'catalog', {
      method: 'GET',
      path: `/products/${c.req.param('id')}`,
    });

    return c.json(data);
  });
};
