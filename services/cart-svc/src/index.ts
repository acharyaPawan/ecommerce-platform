import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createApp({ config });

  const server = serve({
    fetch: app.fetch,
    port: config.port,
  });

  console.log(`[cart-svc] listening on port ${config.port}`);

  const shutdown = async () => {
    console.log("[cart-svc] shutting down");
    server.close(async () => {
      await app.dispose();
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[cart-svc] failed to start", error);
  process.exit(1);
});
