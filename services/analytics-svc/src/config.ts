import { loadAuthConfig, type AuthConfig } from "@ecommerce/core";

export type AnalyticsServiceConfig = {
  serviceName: string;
  port: number;
  internalServiceSecret: string;
  auth: AuthConfig;
};

export function loadConfig(): AnalyticsServiceConfig {
  return {
    serviceName: "analytics-svc",
    port: parseNumber(process.env.PORT, 3010),
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

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : Number.NaN;
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
