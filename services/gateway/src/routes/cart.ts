import { Hono } from 'hono';
import type { ContentfulStatusCode, StatusCode } from 'hono/utils/http-status';
import type { GatewayBindings } from '../types.js';
import { callService } from './helpers.js';
import { requireAuth } from '../middleware/auth.js';

export const registerCartRoutes = (app: Hono<GatewayBindings>) => {
  app.get('/cart', requireAuth(), async (c) => {
    const { data } = await callService<unknown>(c, 'cart', {
      method: 'GET',
      path: '/cart',
      forwardAuth: true,
    });
    return c.json(data);
  });

  app.post('/cart/items', requireAuth(), async (c) => {
    const payload = await c.req.json();
    const response = await callService<unknown>(c, 'cart', {
      method: 'POST',
      path: '/cart/items',
      forwardAuth: true,
      json: payload,
    });
    return c.json(response.data, response.status as ContentfulStatusCode);
  });

  app.patch('/cart/items/:itemId', requireAuth(), async (c) => {
    const payload = await c.req.json();
    const response = await callService<unknown>(c, 'cart', {
      method: 'PATCH',
      path: `/cart/items/${c.req.param('itemId')}`,
      forwardAuth: true,
      json: payload,
    });
    return c.json(response.data, response.status as ContentfulStatusCode);
  });

  app.delete('/cart/items/:itemId', requireAuth(), async (c) => {
    const { status } = await callService<unknown>(c, 'cart', {
      method: 'DELETE',
      path: `/cart/items/${c.req.param('itemId')}`,
      forwardAuth: true,
    });
    return c.body(null, status as StatusCode);
  });
};
