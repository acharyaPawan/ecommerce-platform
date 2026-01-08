import { Hono } from "hono";
import { loadConfig } from "./config.js";
import { createCatalogApi } from "./routes/catalog.js";

const SERVICE_NAME = "catalog-svc";
const config = loadConfig();

export const app = new Hono()
  .get("/", (c) => c.json({ service: SERVICE_NAME, status: "ok" }))
  .get("/healthz", (c) => c.json({ status: "healthy" }))
  .get("/readyz", (c) => c.json({ status: "ready" }))
  .route("/api/catalog", createCatalogApi({ auth: config.auth }));

export type AppType = typeof app;
export default app;
