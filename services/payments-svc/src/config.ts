import { loadAuthConfig, type AuthConfig } from "@ecommerce/core";

export type PaymentsServiceConfig = {
  serviceName: string;
  port: number;
  allowPublicRead: boolean;
  internalServiceSecret: string;
  auth: AuthConfig;
};

export function loadConfig(): PaymentsServiceConfig {
  return {
    serviceName: "payments-svc",
    port: parseNumber(process.env.PORT, 3007),
    allowPublicRead: parseBoolean(process.env.ALLOW_PUBLIC_PAYMENT_READ, false),
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
