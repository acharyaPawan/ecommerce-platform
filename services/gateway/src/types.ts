import type { DownstreamClients } from './clients/types.js';
import type { Logger } from './logger.js';

export type RuntimeEnv = 'development' | 'test' | 'production';

export type ServiceTarget =
  | 'iam'
  | 'catalog'
  | 'inventory'
  | 'cart'
  | 'orders'
  | 'ordersRead'
  | 'payments'
  | 'paymentsRead'
  | 'fulfillment';

export interface ServiceConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface GatewayConfig {
  port: number;
  env: RuntimeEnv;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug';
  idempotencyHeader: string;
  defaultCurrency: string;
  auth: {
    jwksUrl?: string;
    audience?: string;
    issuer?: string;
    devUserHeader: string;
  };
  services: Record<ServiceTarget, ServiceConfig>;
}

export interface AuthenticatedUser {
  userId: string;
  scopes: string[];
  roles: string[];
  expiresAt?: number;
  claims?: Record<string, unknown>;
  token?: string;
}

export interface RequestContextState {
  requestId: string;
  traceparent?: string;
  locale: string;
  currency: string;
  user?: AuthenticatedUser;
  authError?: Error;
  services: DownstreamClients;
  config: GatewayConfig;
  logger: Logger;
}

export type GatewayBindings = {
  Variables: RequestContextState;
};
