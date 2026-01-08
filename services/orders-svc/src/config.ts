import { loadAuthConfig, type AuthConfig } from "@ecommerce/core";

export type OrdersServiceConfig = {
  serviceName: string;
  port: number;
  snapshotSecret: string;
  reservationTtlSeconds?: number;
  auth: AuthConfig;
};

export function loadConfig(): OrdersServiceConfig {
  return {
    serviceName: "orders-svc",
    port: parseNumber(process.env.PORT, 3005),
    snapshotSecret: process.env.CART_SNAPSHOT_SECRET ?? "cart-snapshot-secret",
    reservationTtlSeconds: parseOptionalNumber(process.env.ORDER_RESERVATION_TTL_SECONDS),
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
