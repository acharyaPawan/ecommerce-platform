const DEFAULT_CART_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export type ServiceConfig = {
  serviceName: string;
  port: number;
  redisUrl: string;
  defaultCurrency: string;
  cartTtlSeconds: number;
  userCartTtlSeconds: number;
  idempotencyTtlSeconds: number;
  maxQtyPerItem: number;
  snapshotSecret: string;
  ordersServiceUrl?: string;
};

export function loadConfig(): ServiceConfig {
  const redisUrl =
    process.env.CART_REDIS_URL ?? process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL;

  if (!redisUrl) {
    throw new Error("CART_REDIS_URL (or REDIS_URL/UPSTASH_REDIS_URL) is required");
  }

  return {
    serviceName: "cart-svc",
    port: parseNumber(process.env.PORT, 3000),
    redisUrl,
    defaultCurrency: (process.env.CART_DEFAULT_CURRENCY ?? "USD").toUpperCase(),
    cartTtlSeconds: parseNumber(process.env.CART_TTL_SECONDS, DEFAULT_CART_TTL_SECONDS),
    userCartTtlSeconds: parseNumber(
      process.env.CART_USER_TTL_SECONDS,
      DEFAULT_CART_TTL_SECONDS * 2
    ),
    idempotencyTtlSeconds: parseNumber(
      process.env.CART_IDEMPOTENCY_TTL_SECONDS,
      DEFAULT_IDEMPOTENCY_TTL_SECONDS
    ),
    maxQtyPerItem: parseNumber(process.env.CART_MAX_QTY_PER_ITEM, 25),
    snapshotSecret: process.env.CART_SNAPSHOT_SECRET ?? "cart-snapshot-secret",
    ordersServiceUrl: process.env.ORDERS_SERVICE_URL,
  };
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
