import { Hono } from "hono";
import { CartService } from "./cart/service.js";
import type { OrdersClient, PricingProvider } from "./cart/ports.js";
import type { ServiceConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { createRedisClient, type RedisClient } from "./infra/redis.js";
import { RedisCartStore } from "./infra/cart-store.js";
import { RedisIdempotencyStore } from "./infra/idempotency-store.js";
import type { CartStore } from "./cart/store.js";
import type { IdempotencyStore } from "./infra/idempotency-store.js";
import { createCartRouter } from "./routes/cart.js";
import { HttpCatalogPricingProvider } from "./clients/catalog-pricing.js";
import { HttpOrdersClient } from "./clients/orders.js";
import logger from "./logger.js";

export type AppDependencies = {
  config?: ServiceConfig;
  redis?: RedisClient;
  cartStore?: CartStore;
  idempotencyStore?: IdempotencyStore;
  cartService?: CartService;
  pricingProvider?: PricingProvider;
  ordersClient?: OrdersClient;
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

  const pricingProvider =
    deps.pricingProvider ??
    (config.catalogServiceUrl ? new HttpCatalogPricingProvider({ baseUrl: config.catalogServiceUrl }) : undefined);

  const ordersClient =
    deps.ordersClient ??
    (config.ordersServiceUrl
      ? new HttpOrdersClient({
          baseUrl: config.ordersServiceUrl,
          timeoutMs: config.ordersServiceTimeoutMs,
        })
      : undefined);

  const cartService =
    deps.cartService ??
    new CartService(cartStore, {
      defaultCurrency: config.defaultCurrency,
      maxQtyPerItem: config.maxQtyPerItem,
      snapshotSecret: config.snapshotSecret,
      pricingProvider,
      ordersClient,
    });

  const app = new Hono()
    .get("/", (c) => c.json({ service: config.serviceName, status: "ok" }))
    .get("/healthz", (c) => c.json({ status: "healthy" }))
    .get("/readyz", (c) => c.json({ status: "ready" }))
    .route("/api/cart", createCartRouter({ cartService, idempotencyStore, config }));

  app.onError((err, c) => {
    logger.error({ err }, "cart-svc.unhandled_error");
    return c.json({ error: "Internal Server Error" }, 500);
  });

  const ownsRedis = !deps.redis;
  return decorateApp(app, async () => {
    if (ownsRedis && redis.status !== "end") {
      try {
        await redis.quit();
      } catch (error) {
        logger.warn({ err: error }, "cart-svc.redis.close_failed");
      }
    }
  });
}

function decorateApp(app: Hono, dispose: () => Promise<void>): Hono & { dispose: () => Promise<void> } {
  return Object.assign(app, {
    dispose,
  });
}
