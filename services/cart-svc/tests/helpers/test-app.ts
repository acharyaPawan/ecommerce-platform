import { randomUUID } from 'node:crypto';
import { CartService } from '../../src/cart/service.js';
import type { Cart } from '../../src/cart/types.js';
import type { CartStore, CreateCartInput } from '../../src/cart/store.js';
import type { IdempotencyStore, StoredIdempotentResponse } from '../../src/infra/idempotency-store.js';
import { createApp } from '../../src/app.js';
import type { ServiceConfig } from '../../src/config.js';
import type { PricingProvider, OrdersClient } from '../../src/cart/ports.js';

type CreateTestAppOptions = {
  pricingProvider?: PricingProvider;
  ordersClient?: OrdersClient;
};

export async function createTestApp(options: CreateTestAppOptions = {}) {
  const config: ServiceConfig = {
    serviceName: 'cart-svc',
    port: 0,
    redisUrl: 'redis://localhost',
    defaultCurrency: 'USD',
    cartTtlSeconds: 3600,
    userCartTtlSeconds: 7200,
    idempotencyTtlSeconds: 600,
    maxQtyPerItem: 25,
    snapshotSecret: 'test-secret',
    ordersServiceUrl: undefined,
    ordersServiceTimeoutMs: 2000,
  };

  const cartStore = new InMemoryCartStore();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const cartService = new CartService(cartStore, {
    defaultCurrency: config.defaultCurrency,
    maxQtyPerItem: config.maxQtyPerItem,
    snapshotSecret: config.snapshotSecret,
    pricingProvider: options.pricingProvider,
    ordersClient: options.ordersClient,
  });

  const app = await createApp({ config, cartStore, idempotencyStore, cartService });
  return { app };
}

class InMemoryCartStore implements CartStore {
  private carts = new Map<string, Cart>();
  private userCarts = new Map<string, string>();

  async createCart(input: CreateCartInput): Promise<Cart> {
    const now = new Date().toISOString();
    const cart: Cart = {
      id: input.cartId ?? randomUUID(),
      userId: input.userId ?? null,
      currency: input.currency,
      items: [],
      appliedCoupon: null,
      pricingSnapshot: null,
      status: 'active',
      version: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.carts.set(cart.id, cart);
    if (cart.userId) {
      this.userCarts.set(cart.userId, cart.id);
    }
    return structuredClone(cart);
  }

  async getCart(cartId: string): Promise<Cart | null> {
    const cart = this.carts.get(cartId);
    return cart ? structuredClone(cart) : null;
  }

  async deleteCart(cartId: string): Promise<void> {
    this.carts.delete(cartId);
  }

  async getCartIdByUser(userId: string): Promise<string | null> {
    return this.userCarts.get(userId) ?? null;
  }

  async setUserCart(userId: string, cartId: string): Promise<void> {
    this.userCarts.set(userId, cartId);
  }

  async clearUserCart(userId: string): Promise<void> {
    this.userCarts.delete(userId);
  }

  async updateCart(
    cartId: string,
    mutate: (current: Cart | null) => Promise<Cart | null> | Cart | null
  ): Promise<Cart | null> {
    const current = this.carts.get(cartId) ?? null;
    const mutated = await mutate(current ? structuredClone(current) : null);
    if (!mutated) {
      this.carts.delete(cartId);
      return null;
    }

    const updated: Cart = {
      ...mutated,
      id: cartId,
      createdAt: mutated.createdAt ?? current?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: (current?.version ?? 0) + 1,
    };
    this.carts.set(cartId, updated);
    if (updated.userId) {
      this.userCarts.set(updated.userId, cartId);
    }
    return structuredClone(updated);
  }
}

class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, StoredIdempotentResponse>();

  async get(scope: string, idempotencyKey: string): Promise<StoredIdempotentResponse | null> {
    return this.store.get(this.buildKey(scope, idempotencyKey)) ?? null;
  }

  async set(
    scope: string,
    idempotencyKey: string,
    response: Omit<StoredIdempotentResponse, 'storedAt'>
  ): Promise<void> {
    this.store.set(this.buildKey(scope, idempotencyKey), {
      ...response,
      storedAt: new Date().toISOString(),
    });
  }

  private buildKey(scope: string, key: string): string {
    return `${scope}:${key}`;
  }
}
