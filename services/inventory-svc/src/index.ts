import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import logger from "./logger.js";

const port = Number(process.env.PORT ?? 3003);
const server = serve({
  fetch: app.fetch,
  port,
});
logger.info(`[inventory-svc] listening on port ${port}`);

const shutdown = (): void => {
  server.close(() => {
    process.exit(0);
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

export default app;
