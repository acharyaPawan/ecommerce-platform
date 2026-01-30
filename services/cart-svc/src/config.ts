import { loadAuthConfig, type AuthConfig } from "@ecommerce/core";

const DEFAULT_CART_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const DEFAULT_CATALOG_TIMEOUT_MS = 10000; // 10 seconds

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
  catalogServiceUrl?: string;
  catalogServiceTimeoutMs: number;
  ordersServiceUrl?: string;
  ordersServiceTimeoutMs: number;
  auth: AuthConfig;
};

export function loadConfig(): ServiceConfig {
  const redisUrl =
    process.env.CART_REDIS_URL ?? process.env.REDIS_URL ?? process.env.UPSTASH_REDIS_URL;

  if (!redisUrl) {
    throw new Error("CART_REDIS_URL (or REDIS_URL/UPSTASH_REDIS_URL) is required");
  }

  return {
    serviceName: "cart-svc",
    port: parseNumber(process.env.PORT, 3004),
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
    catalogServiceUrl: process.env.CATALOG_SERVICE_URL,
    catalogServiceTimeoutMs: parseNumber(
      process.env.CATALOG_SERVICE_TIMEOUT_MS,
      DEFAULT_CATALOG_TIMEOUT_MS
    ),
    ordersServiceUrl: process.env.ORDERS_SERVICE_URL ?? "http://localhost:3005",
    ordersServiceTimeoutMs: parseNumber(process.env.ORDERS_SERVICE_TIMEOUT_MS, 10000),
    auth: loadAuthConfig({
      deriveJwksFromIam: {
        iamUrl: process.env.IAM_SERVICE_URL,
      },
      defaults: {
        issuer: "iam-svc",
        audience: "ecommerce-clients",
        devUserHeader: "x-user-id",
      },
    }),
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
