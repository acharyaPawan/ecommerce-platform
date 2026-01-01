import { Hono } from "hono";
import { createUserResolver } from "@ecommerce/core";
import { loadConfig } from "./config.js";
import { createCatalogApi } from "./routes/catalog.js";

const SERVICE_NAME = "catalog-svc";
const config = loadConfig();
const resolveUser = createUserResolver(config.auth);

export const app = new Hono()
  .get("/", (c) => c.json({ service: SERVICE_NAME, status: "ok" }))
  .get("/healthz", (c) => c.json({ status: "healthy" }))
  .get("/readyz", (c) => c.json({ status: "ready" }))
  .route("/api/catalog", createCatalogApi({ resolveUser }));

export type AppType = typeof app;
export default app;
