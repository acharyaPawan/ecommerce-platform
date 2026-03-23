import "dotenv/config";
import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import logger from "./logger.js";

const bootstrap = async () => {
  const config = loadConfig();
  const app = await createApp(config);
  const server = serve({
    fetch: app.fetch,
    port: config.port,
  });

  logger.info({ port: config.port }, "assistant-svc.listening");

  const shutdown = (): void => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

bootstrap().catch((error) => {
  logger.error({ err: error }, "assistant-svc.start_failed");
  process.exit(1);
});
