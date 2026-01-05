import { Hono } from 'hono';
import { createRequestContext } from './middleware/request-context.js';
import { createAuthProvider, attachUser } from './middleware/auth.js';
import { createLogger } from './logger.js';
import { loadConfig } from './config.js';
import { createServiceClients } from './clients/index.js';
import type { GatewayBindings } from './types.js';
import { registerStatusRoutes } from './routes/status.js';
import { registerCatalogRoutes } from './routes/catalog.js';
import { registerCartRoutes } from './routes/cart.js';
import { registerCustomerRoutes } from './routes/customer.js';
import { registerCheckoutRoutes } from './routes/checkout.js';
import { registerOrderRoutes } from './routes/orders.js';

export const createApp = async () => {
  const config = loadConfig();
  const logger = createLogger({
    name: 'gateway',
    level: config.logLevel,
  });
  const clients = createServiceClients(config, logger);
  const authProvider = createAuthProvider(config, logger);

  const app = new Hono<GatewayBindings>();

  app.use('*', createRequestContext({ config, clients, logger }));
  app.use('*', attachUser(authProvider));

  registerStatusRoutes(app);
  registerCatalogRoutes(app);
  registerCartRoutes(app, logger);
  registerCustomerRoutes(app);
  registerCheckoutRoutes(app);
  registerOrderRoutes(app);

  return app;
};
