import { Hono } from "hono";
import { getInventorySummary } from "../inventory/service.js";

export const inventoryApi = new Hono();

inventoryApi.get("/:sku", async (c) => {
  const sku = c.req.param("sku")?.trim();
  if (!sku) {
    return c.json({ error: "SKU is required" }, 400);
  }

  try {
    const summary = await getInventorySummary(sku);
    if (!summary) {
      return c.json({ error: "SKU not found" }, 404);
    }

    return c.json({
      sku: summary.sku,
      onHand: summary.onHand,
      reserved: summary.reserved,
      available: summary.available,
      updatedAt: summary.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[inventory] failed to load summary", error);
    return c.json({ error: "Failed to load inventory" }, 500);
  }
});
