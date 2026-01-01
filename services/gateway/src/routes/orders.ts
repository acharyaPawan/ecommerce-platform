import { Hono } from 'hono';
import type { ContentfulStatusCode, StatusCode } from 'hono/utils/http-status';
import type { GatewayBindings } from '../types.js';
import { callService } from './helpers.js';
import { requireAuth } from '../middleware/auth.js';

interface OrderViewResponse {
  order: unknown;
  payments: unknown;
  shipment: unknown;
  warnings: string[];
}

export const registerOrderRoutes = (app: Hono<GatewayBindings>) => {
  app.get('/orders/:orderId/view', requireAuth(), async (c) => {
    const orderId = c.req.param('orderId');

    const order = await callService<unknown>(c, 'ordersRead', {
      method: 'GET',
      path: `/orders/${orderId}`,
      forwardAuth: true,
    });

    const paymentsPromise = callService<unknown>(c, 'paymentsRead', {
      method: 'GET',
      path: '/payments',
      searchParams: {
        orderId,
      },
      forwardAuth: true,
    });

    const shipmentPromise = callService<unknown>(c, 'fulfillment', {
      method: 'GET',
      path: '/shipments',
      searchParams: {
        orderId,
      },
      forwardAuth: true,
    });

    const [payments, shipment] = await Promise.allSettled([paymentsPromise, shipmentPromise]);
    const warnings: string[] = [];

    if (payments.status === 'rejected') {
      warnings.push('payments_read unavailable');
    }

    if (shipment.status === 'rejected') {
      warnings.push('fulfillment unavailable');
    }

    const payload: OrderViewResponse = {
      order: order.data,
      payments: payments.status === 'fulfilled' ? payments.value.data : null,
      shipment: shipment.status === 'fulfilled' ? shipment.value.data : null,
      warnings,
    };

    return c.json(payload, (warnings.length ? 206 : 200) as ContentfulStatusCode);
  });

  app.get('/orders/:orderId', requireAuth(), async (c) => {
    const { data } = await callService<unknown>(c, 'ordersRead', {
      method: 'GET',
      path: `/orders/${c.req.param('orderId')}`,
      forwardAuth: true,
    });
    return c.json(data);
  });

  app.post('/orders/:orderId/cancel', requireAuth({ scopes: ['orders:write'] }), async (c) => {
    const { data, status } = await callService<unknown>(c, 'orders', {
      method: 'POST',
      path: `/orders/${c.req.param('orderId')}/cancel`,
      json: await c.req.json(),
      forwardAuth: true,
      forwardIdempotencyKey: true,
    });

    return c.json(data, status as ContentfulStatusCode);
  });

  app.post('/payments/:paymentId/capture', requireAuth({ scopes: ['payments:write'] }), async (c) => {
    const { data, status } = await callService<unknown>(c, 'payments', {
      method: 'POST',
      path: `/payments/${c.req.param('paymentId')}/capture`,
      json: await c.req.json(),
      forwardAuth: true,
      forwardIdempotencyKey: true,
    });
    return c.json(data, status as ContentfulStatusCode);
  });
};
