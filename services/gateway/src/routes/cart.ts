import { Hono } from 'hono';
import type { ContentfulStatusCode, StatusCode } from 'hono/utils/http-status';
import type { GatewayBindings } from '../types.js';
import { callService } from './helpers.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from 'hono/logger';
import type { Logger } from '../logger.js';

export const registerCartRoutes = (app: Hono<GatewayBindings>, logger: Logger) => {
  app.get('/cart', requireAuth(), async (c) => {
    const { data } = await callService<unknown>(c, 'cart', {
      method: 'GET',
      path: 'api/cart',
      forwardAuth: true,
    });
    return c.json(data);
  });

  app.post('/cart/items', async (c) => {
    const payload = await c.req.json();
    logger.debug(`Payload ${JSON.stringify(payload, null, 3)}`)
    const response = await callService<unknown>(c, 'cart', {
      method: 'POST',
      path: 'api/cart/items',
      forwardAuth: true,
      json: payload,
    });
    return c.json(response.data, response.status as ContentfulStatusCode);
  });

  app.patch('/cart/items/:itemId', requireAuth(), async (c) => {
    const payload = await c.req.json();
    const response = await callService<unknown>(c, 'cart', {
      method: 'PATCH',
      path: `api/cart/items/${c.req.param('itemId')}`,
      forwardAuth: true,
      json: payload,
    });
    return c.json(response.data, response.status as ContentfulStatusCode);
  });

  app.delete('/cart/items/:itemId', requireAuth(), async (c) => {
    const { status } = await callService<unknown>(c, 'cart', {
      method: 'DELETE',
      path: `api/cart/items/${c.req.param('itemId')}`,
      forwardAuth: true,
    });
    return c.body(null, status as StatusCode);
  });
};
