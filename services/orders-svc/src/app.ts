import { Hono } from "hono";
import { loadConfig, type OrdersServiceConfig } from "./config.js";
import { createOrdersRouter } from "./routes/orders.js";
import logger from "./logger.js";

const config = loadConfig();

export const app = createApp(config);

function createApp(appConfig: OrdersServiceConfig): Hono {
  const app = new Hono();

  app
    .get("/", (c) => c.json({ service: appConfig.serviceName, status: "ok" }))
    .get("/healthz", (c) => c.json({ status: "healthy" }))
    .get("/readyz", (c) => c.json({ status: "ready" }));

  const buildOrdersRouter = () => createOrdersRouter({ config: appConfig });
  app.route("/api/orders", buildOrdersRouter());
  app.route("/orders", buildOrdersRouter());

  app.onError((err, c) => {
    logger.error({ err }, "orders-svc.unhandled_error");
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

export type AppType = typeof app;
export default app;
