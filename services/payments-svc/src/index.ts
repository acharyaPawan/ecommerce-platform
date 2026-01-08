import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const server = serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`[payments-svc] listening on port ${config.port}`);

const shutdown = (): void => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
