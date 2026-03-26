import { Hono } from "hono";
import { loadConfig, type AnalyticsServiceConfig } from "./config.js";
import { createAnalyticsRouter } from "./routes/analytics.js";
import { checkMlServiceReadiness } from "./forecasting/health.js";
import logger from "./logger.js";

const config = loadConfig();

export const app = createApp(config);

export function createApp(
  appConfig: AnalyticsServiceConfig,
  deps: {
    checkMlReadiness?: (
      config: Pick<AnalyticsServiceConfig, "mlServiceUrl">
    ) => Promise<{ ready: boolean; status: number | null }>;
  } = {}
): Hono {
  const app = new Hono();
  const checkMlReadiness = deps.checkMlReadiness ?? checkMlServiceReadiness;

  app
    .get("/", (c) => c.json({ service: appConfig.serviceName, status: "ok" }))
    .get("/healthz", (c) => c.json({ status: "healthy" }))
    .get("/readyz", async (c) => {
      const mlService = await checkMlReadiness(appConfig);

      if (!mlService.ready) {
        return c.json(
          {
            status: "degraded",
            dependencies: {
              mlService: {
                ready: false,
                url: appConfig.mlServiceUrl,
                status: mlService.status,
              },
            },
          },
          503
        );
      }

      return c.json({
        status: "ready",
        dependencies: {
          mlService: {
            ready: true,
            url: appConfig.mlServiceUrl,
            status: mlService.status,
          },
        },
      });
    });

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
