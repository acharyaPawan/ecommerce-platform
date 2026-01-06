import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  AuthorizationError,
  ensureAuthenticated,
  ensureRoles,
  type UserResolver,
  type UserRole,
} from "@ecommerce/core";
import { z } from "zod";
import {
  adjustStock,
  commitReservation,
  getInventorySummary,
  type InventorySummary,
  releaseReservation,
  reserveStock,
} from "../inventory/service.js";

type InventoryRouterDeps = {
  resolveUser: UserResolver;
};

export const createInventoryApi = ({ resolveUser }: InventoryRouterDeps): Hono => {
  const router = new Hono();

  router.get("/:sku", async (c) => {
    const authResponse = await enforceAuthorization(c, resolveUser);
    if (authResponse) {
      return authResponse;
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

  router.post("/adjustments", async (c) => {
    const authResponse = await enforceAuthorization(c, resolveUser, ["admin"]);
    if (authResponse) {
      return authResponse;
    }

    const body = await readJson(c);
    if (!body.success) {
      return c.json({ error: body.error }, 400);
    }

    const parsed = adjustmentSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    try {
      const result = await adjustStock(parsed.data, {
        correlationId: c.req.header("x-request-id") ?? undefined,
      });
      if (result.status === "duplicate") {
        return c.json({ status: "duplicate" });
      }
      return c.json({ status: "applied", summary: serializeSummary(result.summary) });
    } catch (error) {
      console.error("[inventory] failed to adjust stock", error);
      return c.json({ error: "Failed to adjust stock" }, 500);
    }
  });

  router.post("/reservations", async (c) => {
    const authResponse = await enforceAuthorization(c, resolveUser, ["admin"]);
    if (authResponse) {
      return authResponse;
    }

    const body = await readJson(c, { optional: true });
    if (!body.success) {
      return c.json({ error: body.error }, 400);
    }

    const parsed = reservationSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    try {
      const result = await reserveStock(parsed.data, {
        correlationId: c.req.header("x-request-id") ?? undefined,
      });
      if (result.status === "reserved") {
        return c.json(
          {
            status: "reserved",
            items: result.items,
            expiresAt: result.expiresAt?.toISOString() ?? null,
          },
          201
        );
      }
      if (result.status === "failed") {
        const status: ContentfulStatusCode =
          result.reason === "INVALID_ITEMS" ? 400 : (409 as ContentfulStatusCode);
        return c.json(
          {
            status: "failed",
            reason: result.reason,
            insufficientItems: result.insufficientItems,
          },
          status
        );
      }
      return c.json({ status: "duplicate" });
    } catch (error) {
      console.error("[inventory] failed to reserve stock", error);
      return c.json({ error: "Failed to reserve stock" }, 500);
    }
  });

  router.post("/reservations/:orderId/commit", async (c) => {
    const authResponse = await enforceAuthorization(c, resolveUser, ["admin"]);
    if (authResponse) {
      return authResponse;
    }

    const orderId = c.req.param("orderId")?.trim();
    if (!orderId) {
      return c.json({ error: "Order ID is required" }, 400);
    }

    try {
      const result = await commitReservation(orderId, {
        correlationId: c.req.header("x-request-id") ?? undefined,
      });
      if (result.status === "committed") {
        return c.json({ status: "committed", items: result.items });
      }
      if (result.status === "noop") {
        return c.json({ status: "noop" }, 202);
      }
      return c.json({ status: "duplicate" });
    } catch (error) {
      console.error("[inventory] failed to commit reservation", error);
      return c.json({ error: "Failed to commit reservation" }, 500);
    }
  });

  router.post("/reservations/:orderId/release", async (c) => {
    const authResponse = await enforceAuthorization(c, resolveUser, ["admin"]);
    if (authResponse) {
      return authResponse;
    }

    const orderId = c.req.param("orderId")?.trim();
    if (!orderId) {
      return c.json({ error: "Order ID is required" }, 400);
    }

    const body = await readJson(c);
    if (!body.success) {
      return c.json({ error: body.error }, 400);
    }

    const parsed = releaseSchema.safeParse(body.data ?? {});
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    try {
      const result = await releaseReservation(orderId, parsed.data.reason, "release", {
        correlationId: c.req.header("x-request-id") ?? undefined,
      });
      if (result.status === "released" || result.status === "expired") {
        return c.json({ status: result.status, items: result.items });
      }
      if (result.status === "noop") {
        return c.json({ status: "noop" }, 202);
      }
      return c.json({ status: "duplicate" });
    } catch (error) {
      console.error("[inventory] failed to release reservation", error);
      return c.json({ error: "Failed to release reservation" }, 500);
    }
  });

  return router;
};

const adjustmentSchema = z.object({
  sku: z.string().min(1),
  delta: z.number().int(),
  reason: z.string().min(1),
  referenceId: z.string().min(1).optional(),
});

const reservationItemSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().int().positive(),
});

const reservationSchema = z.object({
  orderId: z.string().min(1),
  items: z.array(reservationItemSchema).min(1),
  ttlSeconds: z.number().int().positive().max(24 * 60 * 60).optional(),
});

const releaseSchema = z.object({
  reason: z.string().min(1),
});

type JsonResult =
  | { success: true; data: unknown }
  | { success: false; error: "Invalid JSON payload" };

async function readJson(c: Context, options?: { optional?: boolean }): Promise<JsonResult> {
  const raw = await c.req.text();
  if (!raw.trim()) {
    if (options?.optional) {
      return { success: true, data: undefined };
    }
    return { success: false, error: "Invalid JSON payload" };
  }
  try {
    return { success: true, data: JSON.parse(raw) as unknown };
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }
}

async function enforceAuthorization(
  c: Context,
  resolveUser: UserResolver,
  roles?: UserRole[]
): Promise<Response | null> {
  try {
    const user = await resolveUser(c.req.raw);
    if (roles?.length) {
      ensureRoles(user, roles);
    } else {
      ensureAuthenticated(user);
    }
    return null;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return c.json(
        {
          error: error.status === 401 ? "unauthorized" : "forbidden",
          message: error.message,
        },
        error.status as ContentfulStatusCode
      );
    }
    throw error;
  }
}

const serializeSummary = (summary: InventorySummary) => ({
  sku: summary.sku,
  onHand: summary.onHand,
  reserved: summary.reserved,
  available: summary.available,
  updatedAt: summary.updatedAt.toISOString(),
});
