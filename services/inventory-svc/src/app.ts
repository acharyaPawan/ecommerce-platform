import { Hono } from "hono";
import { inventoryApi } from "./routes/inventory.js";

const SERVICE_NAME = "inventory-svc";

export const app = new Hono()
  .get("/", (c) => c.json({ service: SERVICE_NAME, status: "ok" }))
  .get("/healthz", (c) => c.json({ status: "healthy" }))
  .get("/readyz", (c) => c.json({ status: "ready" }))
  .route("/api/inventory", inventoryApi);

export type AppType = typeof app;
export default app;
