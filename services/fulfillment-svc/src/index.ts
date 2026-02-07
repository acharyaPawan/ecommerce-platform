import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import logger from "./logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = createApp({ config });

  const server = serve({
    fetch: app.fetch,
    port: config.port,
  });

  logger.info({ port: config.port }, "fulfillment-svc.listening");

  const shutdown = () => {
    logger.info("fulfillment-svc.shutting_down");
    server.close(() => {
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  logger.error({ err: error }, "fulfillment-svc.start_failed");
  process.exit(1);
});
