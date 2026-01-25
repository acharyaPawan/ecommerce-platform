import { Hono } from "hono";
import { loadConfig, type PaymentsServiceConfig } from "./config.js";
import { createPaymentsRouter } from "./routes/payments.js";
import logger from "./logger.js";

const config = loadConfig();

export const app = createApp(config);

function createApp(appConfig: PaymentsServiceConfig): Hono {
  const app = new Hono();

  app
    .get("/", (c) => c.json({ service: appConfig.serviceName, status: "ok" }))
    .get("/healthz", (c) => c.json({ status: "healthy" }))
    .get("/readyz", (c) => c.json({ status: "ready" }));

  const buildPaymentsRouter = () => createPaymentsRouter({ config: appConfig });
  app.route("/api/payments", buildPaymentsRouter());
  app.route("/payments", buildPaymentsRouter());

  app.onError((err, c) => {
    logger.error({ err }, "payments-svc.unhandled_error");
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

export type AppType = typeof app;
export default app;
