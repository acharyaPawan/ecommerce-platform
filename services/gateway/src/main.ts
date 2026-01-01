import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const bootstrap = async () => {
  const config = loadConfig();
  const logger = createLogger({ name: 'gateway', level: config.logLevel });
  const app = await createApp();

  serve({
    fetch: app.fetch,
    port: config.port,
  });

  logger.info('gateway.started', {
    port: config.port,
    env: config.env,
  });
};

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
