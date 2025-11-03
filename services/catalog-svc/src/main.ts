import { serve } from '@hono/node-server';
import { createApp } from './app';

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);

  serve({
    fetch: app.fetch,
    port
  });

  console.log('[catalog-svc] listening on port ' + port);
}

bootstrap().catch((err) => {
  console.error('[catalog-svc] failed to bootstrap', err);
  process.exit(1);
});
