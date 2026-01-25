import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger, type Logger } from './logger.js';

let startupLogger: Logger | undefined;
const fallbackLogger = createLogger({ name: 'gateway', level: 'info' });

const bootstrap = async () => {
  const config = loadConfig();
  const logger = createLogger({ name: 'gateway', level: config.logLevel });
  startupLogger = logger;
  const app = await createApp();

  serve({
    fetch: app.fetch,
    port: config.port,
  });

  logger.info(
    {
      port: config.port,
      env: config.env,
    },
    'gateway.started',
  );
};

bootstrap().catch((error) => {
  (startupLogger ?? fallbackLogger).error({ err: error }, 'gateway.start_failed');
  process.exit(1);
});
