import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { loadConfig } from "./config.js";
import logger from "./logger.js";

const config = loadConfig();
const server = serve({
  fetch: app.fetch,
  port: config.port,
});

logger.info({ port: config.port }, "orders-svc.listening");

const shutdown = (): void => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
