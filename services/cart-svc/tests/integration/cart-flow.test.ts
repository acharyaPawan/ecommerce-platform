import { describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/test-app.js';

describe('cart HTTP flows', () => {
  it('creates, updates, and checks out an anonymous cart', async () => {
    const { app } = await createTestApp();
    try {
      const addRes = await app.request('/api/cart/items', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'anon-add-1',
        },
        body: JSON.stringify({ sku: 'sku-123', qty: 2 }),
      });
      expect(addRes.status).toBe(201);
      expect(addRes.headers.get('x-idempotent-replay')).toBe('false');

      const cartId = addRes.headers.get('x-cart-id');
      expect(cartId).toBeTruthy();
      const payload = await addRes.json();
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0].qty).toBe(2);

      const getRes = await app.request('/api/cart', {
        headers: {
          'x-cart-id': cartId!,
        },
      });
      expect(getRes.status).toBe(200);
      const getPayload = await getRes.json();
      expect(getPayload.items[0].sku).toBe('SKU-123');

      const patchRes = await app.request(`/api/cart/items/${encodeURIComponent('sku-123')}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-cart-id': cartId!,
          'idempotency-key': 'anon-update-1',
        },
        body: JSON.stringify({ qty: 5 }),
      });
      expect(patchRes.status).toBe(200);
      const patchPayload = await patchRes.json();
      expect(patchPayload.items[0].qty).toBe(5);

      const checkoutRes = await app.request('/api/cart/checkout', {
        method: 'POST',
        headers: {
          'x-cart-id': cartId!,
          'idempotency-key': 'anon-checkout-1',
        },
      });
      expect(checkoutRes.status).toBe(200);
      const checkoutPayload = await checkoutRes.json<{ snapshot: { cartId: string; items: any[] } }>();
      expect(checkoutPayload.snapshot.cartId).toBe(cartId);
      expect(checkoutPayload.snapshot.items).toHaveLength(1);
    } finally {
      await app.dispose();
    }
  });

  it('replays idempotent requests when the first response is lost', async () => {
    const { app } = await createTestApp();
    try {
      const headers = {
        'content-type': 'application/json',
        'idempotency-key': 'anon-add-replay',
      };

      const first = await app.request('/api/cart/items', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sku: 'sku-999', qty: 1 }),
      });
      expect(first.status).toBe(201);
      const cartId = first.headers.get('x-cart-id');
      expect(cartId).toBeTruthy();

      const second = await app.request('/api/cart/items', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sku: 'sku-999', qty: 1 }),
      });
      expect(second.status).toBe(201);
      expect(second.headers.get('x-cart-id')).toBe(cartId);
      expect(second.headers.get('x-idempotent-replay')).toBe('true');
      const payload = await second.json();
      expect(payload.items[0].qty).toBe(1);
    } finally {
      await app.dispose();
    }
  });
});
