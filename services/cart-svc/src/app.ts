import { Hono } from "hono";
import { CartService } from "./cart/service.js";
import type { ServiceConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { createRedisClient, type RedisClient } from "./infra/redis.js";
import { RedisCartStore } from "./infra/cart-store.js";
import { RedisIdempotencyStore } from "./infra/idempotency-store.js";
import type { CartStore } from "./cart/store.js";
import type { IdempotencyStore } from "./infra/idempotency-store.js";
import { createCartRouter } from "./routes/cart.js";

export type AppDependencies = {
  config?: ServiceConfig;
  redis?: RedisClient;
  cartStore?: CartStore;
  idempotencyStore?: IdempotencyStore;
  cartService?: CartService;
};

export type CartApp = ReturnType<typeof decorateApp>;

export async function createApp(deps: AppDependencies = {}): Promise<CartApp> {
  const config = deps.config ?? loadConfig();
  const redis = deps.redis ?? createRedisClient({ url: config.redisUrl });
  const cartStore =
    deps.cartStore ??
    new RedisCartStore(redis, {
      cartTtlSeconds: config.cartTtlSeconds,
      userCartTtlSeconds: config.userCartTtlSeconds,
      maxUpdateRetries: 8,
    });

  const idempotencyStore =
    deps.idempotencyStore ??
    new RedisIdempotencyStore(redis, {
      ttlSeconds: config.idempotencyTtlSeconds,
    });

  const cartService =
    deps.cartService ??
    new CartService(cartStore, {
      defaultCurrency: config.defaultCurrency,
      maxQtyPerItem: config.maxQtyPerItem,
      snapshotSecret: config.snapshotSecret,
      ordersServiceUrl: config.ordersServiceUrl,
    });

  const app = new Hono()
    .get("/", (c) => c.json({ service: config.serviceName, status: "ok" }))
    .get("/healthz", (c) => c.json({ status: "healthy" }))
    .get("/readyz", (c) => c.json({ status: "ready" }))
    .route("/api/cart", createCartRouter({ cartService, idempotencyStore, config }));

  app.onError((err, c) => {
    console.error("[cart-svc] unhandled error", err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  const ownsRedis = !deps.redis;
  return decorateApp(app, async () => {
    if (ownsRedis && redis.status !== "end") {
      try {
        await redis.quit();
      } catch (error) {
        console.warn("[cart-svc] failed to close redis", error);
      }
    }
  });
}

function decorateApp(app: Hono, dispose: () => Promise<void>): Hono & { dispose: () => Promise<void> } {
  return Object.assign(app, {
    dispose,
  });
}
