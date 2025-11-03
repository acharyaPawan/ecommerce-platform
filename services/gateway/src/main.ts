import { serve } from '@hono/node-server';
import { createApp } from './app';

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 8080);

  serve({
    fetch: app.fetch,
    port
  });

  console.log(`[gateway] listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('[gateway] failed to bootstrap', err);
  process.exit(1);
});
