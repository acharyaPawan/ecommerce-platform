import { Hono } from "hono";
import { catalogApi } from "./routes/catalog.js";

const SERVICE_NAME = "catalog-svc";

export const app = new Hono()
  .get("/", (c) => c.json({ service: SERVICE_NAME, status: "ok" }))
  .get("/healthz", (c) => c.json({ status: "healthy" }))
  .get("/readyz", (c) => c.json({ status: "ready" }))
  .route("/api/catalog", catalogApi);

export type AppType = typeof app;
export default app;
