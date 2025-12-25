import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const server = serve({
  fetch: app.fetch,
  port,
});
console.log(`[catalog-svc] listening on port ${port}`);

const shutdown = (): void => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
