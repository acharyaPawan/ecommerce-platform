import { serve } from '@hono/node-server'
import { auth } from './auth';
import { Hono } from 'hono';
import { app } from './app'; 


const port = Number(process.env.PORT ?? 3000);
const server = serve({
  fetch: app.fetch,
  port,
});
console.log(`[iam-svc] listening on port ${port}`);

// graceful shutdown
process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})

export default app
