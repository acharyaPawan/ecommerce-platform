import { z } from 'zod';
import type { GatewayConfig, RuntimeEnv, ServiceConfig, ServiceTarget } from './types.js';

const runtimeEnvSchema = z.enum(['development', 'test', 'production']);
const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug']);

const serviceDefaults: Record<ServiceTarget, { url: string; timeoutMs: number }> = {
  iam: { url: 'http://localhost:3001', timeoutMs: 400 },
  catalog: { url: 'http://localhost:3002', timeoutMs: 10000 },
  inventory: { url: 'http://localhost:3003', timeoutMs: 500 },
  cart: { url: 'http://localhost:3004', timeoutMs: 400 },
  orders: { url: 'http://localhost:3005', timeoutMs: 800 },
  ordersRead: { url: 'http://localhost:3005', timeoutMs: 600 },
  payments: { url: 'http://localhost:3007', timeoutMs: 800 },
  paymentsRead: { url: 'http://localhost:3008', timeoutMs: 600 },
  fulfillment: { url: 'http://localhost:3009', timeoutMs: 600 },
};

const envSchema = z.object({
  NODE_ENV: runtimeEnvSchema.default('development'),
  PORT: z.coerce.number().int().positive().default(3006),
  LOG_LEVEL: logLevelSchema.default('info'),
  IDEMPOTENCY_HEADER: z.string().min(1).default('idempotency-key'),
  DEFAULT_CURRENCY: z.string().min(3).default('USD'),
  IAM_JWKS_URL: z.string().url().optional(),
  IAM_JWT_AUDIENCE: z.string().optional(),
  IAM_JWT_ISSUER: z.string().optional(),
  DEV_USER_HEADER: z.string().min(1).default('x-user-id'),
  ...Object.entries(serviceDefaults).reduce<Record<string, z.ZodTypeAny>>((acc, [key, defaults]) => {
    const upper = key.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase();
    acc[`${upper}_SERVICE_URL`] = z.string().url().default(defaults.url);
    acc[`${upper}_SERVICE_TIMEOUT_MS`] = z.coerce.number().int().positive().default(defaults.timeoutMs);
    return acc;
  }, {}),
});

type EnvShape = z.infer<typeof envSchema>;

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): GatewayConfig => {
  const parsed = envSchema.parse(env);
  const services = Object.keys(serviceDefaults).reduce<Record<ServiceTarget, ServiceConfig>>(
    (acc, key) => {
      const upper = key.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase();
      acc[key as ServiceTarget] = {
        baseUrl: parsed[`${upper}_SERVICE_URL` as keyof EnvShape] as string,
        timeoutMs: parsed[`${upper}_SERVICE_TIMEOUT_MS` as keyof EnvShape] as number,
      };
      return acc;
    },
    {} as Record<ServiceTarget, ServiceConfig>,
  );

  const jwksUrl = parsed.IAM_JWKS_URL ?? `${stripTrailingSlash(services.iam.baseUrl)}/api/auth/jwks`;

  return {
    port: parsed.PORT,
    env: parsed.NODE_ENV as RuntimeEnv,
    logLevel: parsed.LOG_LEVEL,
    idempotencyHeader: parsed.IDEMPOTENCY_HEADER.toLowerCase(),
    defaultCurrency: parsed.DEFAULT_CURRENCY,
    auth: {
      jwksUrl,
      audience: parsed.IAM_JWT_AUDIENCE,
      issuer: parsed.IAM_JWT_ISSUER,
      devUserHeader: parsed.DEV_USER_HEADER.toLowerCase(),
    },
    services,
  };
};
