import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import logger from "./logger.js";

const port = Number(process.env.PORT ?? 3002);
const server = serve({
  fetch: app.fetch,
  port,
});
logger.info({ port }, "catalog-svc.listening");

const shutdown = (): void => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
