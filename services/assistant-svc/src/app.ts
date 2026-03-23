import { Hono } from "hono";
import { HonoBindings, HonoVariables, MastraServer } from "@mastra/hono";
import type { AssistantServiceConfig } from "./config.js";
import { createMastra } from "./mastra/index.js";
import { createAssistantRouter } from "./routes/assistant.js";
import logger from "./logger.js";

export async function createApp(config: AssistantServiceConfig) {
  const mastra = createMastra(config);
  const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();

  app.get("/", (c) => c.json({ service: config.serviceName, status: "ok" }));
  app.get("/healthz", (c) => c.json({ status: "healthy" }));
  app.get("/readyz", (c) => c.json({ status: "ready" }));

  const server = new MastraServer({
    app,
    mastra,
    prefix: "/api/mastra",
  });

  await server.init();

  app.route("/api/assistant", createAssistantRouter({ mastra }));
  app.route("/assistant", createAssistantRouter({ mastra }));

  app.onError((err, c) => {
    logger.error({ err }, "assistant-svc.unhandled_error");
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}
