import { randomUUID } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import type { DownstreamClients } from '../clients/types.js';
import type { GatewayConfig } from '../types.js';
import type { Logger } from '../logger.js';

const DEFAULT_LOCALE = 'en-US';

const parseLocale = (header?: string | null): string => {
  if (!header) {
    return DEFAULT_LOCALE;
  }
  return header.split(',')[0]?.trim() || DEFAULT_LOCALE;
};

interface RequestContextOptions {
  config: GatewayConfig;
  clients: DownstreamClients;
  logger: Logger;
}

export const createRequestContext = ({ config, clients, logger }: RequestContextOptions) =>
  createMiddleware(async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? randomUUID();
    const traceparent = c.req.header('traceparent');
    const locale = parseLocale(c.req.header('accept-language'));
    const currency = c.req.header('x-currency') ?? config.defaultCurrency;
    const start = Date.now();

    const requestLogger = logger.child({
      requestId,
      method: c.req.method,
      path: c.req.path,
    });

    c.set('requestId', requestId);
    c.set('traceparent', traceparent ?? '');
    c.set('locale', locale);
    c.set('currency', currency);
    c.set('services', clients);
    c.set('config', config);
    c.set('logger', requestLogger);

    c.res.headers.set('x-request-id', requestId);
    if (traceparent) {
      c.res.headers.set('traceparent', traceparent);
    }

    try {
      await next();
    } finally {
      requestLogger.info(
        {
          status: c.res.status,
          durationMs: Date.now() - start,
        },
        'request.completed',
      );
    }
  });
