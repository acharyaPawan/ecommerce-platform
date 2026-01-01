import { Hono } from 'hono';
import type { GatewayBindings } from '../types.js';
import { callService } from './helpers.js';
import { requireAuth } from '../middleware/auth.js';

interface DashboardResponse {
  profile: unknown | null;
  cartSummary: unknown | null;
  recentOrders: unknown[];
  warnings: string[];
}

export const registerCustomerRoutes = (app: Hono<GatewayBindings>) => {
  app.get('/me/dashboard', requireAuth(), async (c) => {
    const warnings: string[] = [];

    const profilePromise = callService<unknown>(c, 'iam', {
      method: 'GET',
      path: '/me',
      forwardAuth: true,
    });
    const cartPromise = callService<unknown>(c, 'cart', {
      method: 'GET',
      path: '/cart',
      forwardAuth: true,
    });
    const userId = c.get('user')?.userId;
    const ordersPromise = callService<unknown>(c, 'ordersRead', {
      method: 'GET',
      path: '/orders',
      searchParams: userId
        ? {
            userId,
            limit: 5,
          }
        : {
            limit: 5,
          },
      forwardAuth: true,
    });

    const [profile, cart, orders] = await Promise.allSettled([profilePromise, cartPromise, ordersPromise]);

    if (profile.status === 'rejected') {
      warnings.push('iam unavailable');
    }
    if (cart.status === 'rejected') {
      warnings.push('cart unavailable');
    }
    if (orders.status === 'rejected') {
      warnings.push('orders unavailable');
    }

    const response: DashboardResponse = {
      profile: profile.status === 'fulfilled' ? profile.value.data : null,
      cartSummary: cart.status === 'fulfilled' ? cart.value.data : null,
      recentOrders: orders.status === 'fulfilled' ? (orders.value.data as unknown[]) : [],
      warnings,
    };

    return c.json(response, { status: warnings.length ? 206 : 200 });
  });
};
