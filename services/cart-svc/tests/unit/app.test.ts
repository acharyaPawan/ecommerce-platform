import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('cart-svc app', () => {
  beforeAll(() => {
    process.env.CART_REDIS_URL = process.env.CART_REDIS_URL ?? 'redis://localhost:6379';
  });

  it('returns ok from root endpoint', async () => {
    const app = await createApp();
    try {
      const res = await app.request('/');
      expect(res.status).toBe(200);

      const payload = await res.json<{ service: string; status: string }>();
      expect(payload.service).toBe('cart-svc');
      expect(payload.status).toBe('ok');
    } finally {
      await app.dispose();
    }
  });

  it('exposes healthz endpoint', async () => {
    const app = await createApp();
    try {
      const res = await app.request('/healthz');
      expect(res.status).toBe(200);
    } finally {
      await app.dispose();
    }
  });
});
