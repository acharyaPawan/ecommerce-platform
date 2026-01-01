import type { GatewayConfig } from '../types.js';
import type { Logger } from '../logger.js';
import type { DownstreamClients } from './types.js';
import { HttpServiceClient } from './http-client.js';

export const createServiceClients = (config: GatewayConfig, logger: Logger): DownstreamClients => ({
  iam: new HttpServiceClient({
    name: 'iam',
    baseUrl: config.services.iam.baseUrl,
    defaultTimeoutMs: config.services.iam.timeoutMs,
    logger,
  }),
  catalog: new HttpServiceClient({
    name: 'catalog',
    baseUrl: config.services.catalog.baseUrl,
    defaultTimeoutMs: config.services.catalog.timeoutMs,
    logger,
  }),
  inventory: new HttpServiceClient({
    name: 'inventory',
    baseUrl: config.services.inventory.baseUrl,
    defaultTimeoutMs: config.services.inventory.timeoutMs,
    logger,
  }),
  cart: new HttpServiceClient({
    name: 'cart',
    baseUrl: config.services.cart.baseUrl,
    defaultTimeoutMs: config.services.cart.timeoutMs,
    logger,
  }),
  orders: new HttpServiceClient({
    name: 'orders',
    baseUrl: config.services.orders.baseUrl,
    defaultTimeoutMs: config.services.orders.timeoutMs,
    logger,
  }),
  ordersRead: new HttpServiceClient({
    name: 'ordersRead',
    baseUrl: config.services.ordersRead.baseUrl,
    defaultTimeoutMs: config.services.ordersRead.timeoutMs,
    logger,
  }),
  payments: new HttpServiceClient({
    name: 'payments',
    baseUrl: config.services.payments.baseUrl,
    defaultTimeoutMs: config.services.payments.timeoutMs,
    logger,
  }),
  paymentsRead: new HttpServiceClient({
    name: 'paymentsRead',
    baseUrl: config.services.paymentsRead.baseUrl,
    defaultTimeoutMs: config.services.paymentsRead.timeoutMs,
    logger,
  }),
  fulfillment: new HttpServiceClient({
    name: 'fulfillment',
    baseUrl: config.services.fulfillment.baseUrl,
    defaultTimeoutMs: config.services.fulfillment.timeoutMs,
    logger,
  }),
});
