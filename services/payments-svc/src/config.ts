import { loadAuthConfig, type AuthConfig } from "@ecommerce/core";

export type PaymentsServiceConfig = {
  serviceName: string;
  port: number;
  auth: AuthConfig;
};

export function loadConfig(): PaymentsServiceConfig {
  return {
    serviceName: "payments-svc",
    port: parseNumber(process.env.PORT, 3007),
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
