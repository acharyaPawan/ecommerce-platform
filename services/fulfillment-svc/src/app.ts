import { Hono } from "hono";
import type { FulfillmentServiceConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { FulfillmentService } from "./fulfillment/service.js";
import { createFulfillmentRouter } from "./routes/fulfillment.js";
import logger from "./logger.js";

export type AppDependencies = {
  config?: FulfillmentServiceConfig;
  fulfillmentService?: FulfillmentService;
};

export type FulfillmentApp = ReturnType<typeof createApp>;

export function createApp(deps: AppDependencies = {}) {
  const config = deps.config ?? loadConfig();
  const fulfillmentService = deps.fulfillmentService ?? new FulfillmentService(config);
  const routes = createFulfillmentRouter({ service: fulfillmentService, config });

  const app = new Hono()
    .get("/", (c) => c.json({ service: config.serviceName, status: "ok" }))
    .get("/healthz", (c) => c.json({ status: "healthy" }))
    .get("/readyz", (c) => c.json({ status: "ready" }))
    .route("/api/fulfillment", routes)
    .route("/", routes);

  app.onError((err, c) => {
    logger.error({ err }, "fulfillment.unhandled_error");
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}
