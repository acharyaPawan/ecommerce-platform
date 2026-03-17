import { Hono } from "hono";
import { loadConfig, type AnalyticsServiceConfig } from "./config.js";
import { createAnalyticsRouter } from "./routes/analytics.js";
import logger from "./logger.js";

const config = loadConfig();

export const app = createApp(config);

export function createApp(appConfig: AnalyticsServiceConfig): Hono {
  const app = new Hono();

  app
    .get("/", (c) => c.json({ service: appConfig.serviceName, status: "ok" }))
    .get("/healthz", (c) => c.json({ status: "healthy" }))
    .get("/readyz", (c) => c.json({ status: "ready" }));

  app.route("/api/analytics", createAnalyticsRouter({ config: appConfig }));
  app.route("/analytics", createAnalyticsRouter({ config: appConfig }));

  app.onError((err, c) => {
    logger.error({ err }, "analytics-svc.unhandled_error");
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

export type AppType = typeof app;
export default app;
