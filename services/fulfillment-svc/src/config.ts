import { loadAuthConfig, type AuthConfig } from "@ecommerce/core";

export type FulfillmentServiceConfig = {
  serviceName: string;
  port: number;
  defaultCurrency: string;
  defaultCountry: string;
  auth: AuthConfig;
};

export function loadConfig(): FulfillmentServiceConfig {
  return {
    serviceName: "fulfillment-svc",
    port: parseNumber(process.env.PORT, 3009),
    defaultCurrency: (process.env.DEFAULT_CURRENCY ?? "USD").toUpperCase(),
    defaultCountry: (process.env.FULFILLMENT_DEFAULT_COUNTRY ?? "US").toUpperCase(),
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
