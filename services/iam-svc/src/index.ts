import { serve } from '@hono/node-server'
import { auth } from './auth';
import { Hono } from 'hono';
import { app } from './app'; 
import { logger } from './logger';


const port = Number(process.env.PORT ?? 3001);
const server = serve({
  fetch: app.fetch,
  port,
});
logger.info({ port }, "iam-svc.listening");

// graceful shutdown
process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      logger.error({ err }, "iam-svc.shutdown_failed");
      process.exit(1)
    }
    process.exit(0)
  })
})

export default app
