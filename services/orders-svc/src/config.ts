import { loadAuthConfig, type AuthConfig } from "@ecommerce/core";

export type OrdersServiceConfig = {
  serviceName: string;
  port: number;
  snapshotSecret: string;
  reservationTtlSeconds?: number;
  allowPublicRead: boolean;
  paymentsServiceUrl: string;
  fulfillmentServiceUrl: string;
  internalServiceSecret: string;
  auth: AuthConfig;
};

export function loadConfig(): OrdersServiceConfig {
  return {
    serviceName: "orders-svc",
    port: parseNumber(process.env.PORT, 3005),
    snapshotSecret: process.env.CART_SNAPSHOT_SECRET ?? "cart-snapshot-secret",
    reservationTtlSeconds: parseOptionalNumber(process.env.ORDER_RESERVATION_TTL_SECONDS),
    allowPublicRead: parseBoolean(process.env.ALLOW_PUBLIC_ORDER_READ, false),
    paymentsServiceUrl: process.env.PAYMENTS_SERVICE_URL ?? "http://localhost:3007",
    fulfillmentServiceUrl: process.env.FULFILLMENT_SERVICE_URL ?? "http://localhost:3009",
    internalServiceSecret: process.env.INTERNAL_SERVICE_SECRET ?? "dev-internal-secret",
    auth: loadAuthConfig({
      deriveJwksFromIam: {
        iamUrl: process.env.IAM_SERVICE_URL,
      },
      defaults: {
        devUserHeader: "x-user-id",
      },
    }),
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : Number.NaN;
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}
