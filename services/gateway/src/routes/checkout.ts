import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { GatewayBindings } from '../types.js';
import { callService } from './helpers.js';
import { requireAuth } from '../middleware/auth.js';

interface CheckoutSummary {
  cart: unknown;
  availability: unknown;
  shippingOptions: unknown;
}

export const registerCheckoutRoutes = (app: Hono<GatewayBindings>) => {
  app.get('/checkout/summary', requireAuth(), async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'unauthorized' }, 401 as ContentfulStatusCode);
    }

    const cartPromise = callService<unknown>(c, 'cart', {
      method: 'GET',
      path: '/cart',
      forwardAuth: true,
    });

    const [cartResult] = await Promise.all([cartPromise]);
    if (!cartResult.data) {
      return c.json(
        {
          error: 'cart_unavailable',
        },
        502 as ContentfulStatusCode,
      );
    }

    const cart = cartResult.data as { items?: Array<{ sku: string }> };
    const skus = (cart.items ?? []).map((item) => item.sku);

    const [inventoryResult, shippingResult] = await Promise.all([
      callService<unknown>(c, 'inventory', {
        method: 'GET',
        path: '/availability',
        searchParams: {
          sku: skus,
        },
        forwardAuth: true,
      }),
      callService<unknown>(c, 'fulfillment', {
        method: 'GET',
        path: '/shipping/options',
        searchParams: {
          country: c.req.query('country') ?? 'US',
          postalCode: c.req.query('postalCode') ?? '',
        },
      }),
    ]);

    const body: CheckoutSummary = {
      cart: cartResult.data,
      availability: inventoryResult.data,
      shippingOptions: shippingResult.data,
    };

    return c.json(body);
  });

  app.post('/checkout', requireAuth(), async (c) => {
    const idempotencyHeader = c.get('config').idempotencyHeader;
    const idempotencyKey = c.req.header(idempotencyHeader);
    if (!idempotencyKey) {
      return c.json(
        {
          error: 'missing_idempotency_key',
          message: `Mutations require ${idempotencyHeader} header`,
        },
        400 as ContentfulStatusCode,
      );
    }

    const payload = await c.req.json();
    const command = {
      ...payload,
      userId: c.get('user')?.userId,
      locale: c.get('locale'),
      currency: c.get('currency'),
    };

    const { data, status } = await callService<unknown>(c, 'orders', {
      method: 'POST',
      path: '/orders',
      json: command,
      forwardAuth: true,
      forwardIdempotencyKey: true,
    });

    const responseStatus = status === 200 ? 202 : status;
    return c.json(
      {
        order: data,
      },
      responseStatus as ContentfulStatusCode,
    );
  });
};
