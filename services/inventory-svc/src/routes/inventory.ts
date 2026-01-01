import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AuthorizationError, ensureAuthenticated, type UserResolver } from "@ecommerce/core";
import { getInventorySummary } from "../inventory/service.js";

type InventoryRouterDeps = {
  resolveUser: UserResolver;
};

export const createInventoryApi = ({ resolveUser }: InventoryRouterDeps): Hono => {
  const router = new Hono();

  router.get("/:sku", async (c) => {
    try {
      const user = await resolveUser(c.req.raw);
      ensureAuthenticated(user);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return c.json(
          {
            error: "unauthorized",
            message: error.message,
          },
          error.status as ContentfulStatusCode
        );
      }
      throw error;
    }

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

  return router;
};
