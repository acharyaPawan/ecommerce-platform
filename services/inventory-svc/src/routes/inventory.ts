import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  AuthorizationError,
  readBearerToken,
  resolveVerifyAuthTokenOptions,
  verifyAuthToken,
  type AuthConfig,
  type VerifiedAuthTokenPayload,
  type VerifyAuthTokenOptions,
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
import logger from "../logger.js";

type InventoryRouterDeps = {
  auth: AuthConfig;
};

export const createInventoryApi = ({ auth }: InventoryRouterDeps): Hono => {
  const router = new Hono();
  const verifyOptions = resolveVerifyAuthTokenOptions(auth);
  const authenticateRequest = createRequestAuthenticator(verifyOptions);

  router.get("/:sku", async (c) => {
    const authResponse = await enforceAuthorization(c, authenticateRequest);
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
      logger.error({ err: error }, "[inventory] failed to load summary");
      return c.json({ error: "Failed to load inventory" }, 500);
    }
  });

  router.post("/adjustments", async (c) => {
    const authResponse = await enforceAuthorization(c, authenticateRequest, { requireAdmin: true });
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
      logger.error({ err: error }, "[inventory] failed to adjust stock");
      return c.json({ error: "Failed to adjust stock" }, 500);
    }
  });

  router.post("/reservations", async (c) => {
    const authResponse = await enforceAuthorization(c, authenticateRequest, { requireAdmin: true });
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
      logger.error({ err: error }, "[inventory] failed to reserve stock");
      return c.json({ error: "Failed to reserve stock" }, 500);
    }
  });

  router.post("/reservations/:orderId/commit", async (c) => {
    const authResponse = await enforceAuthorization(c, authenticateRequest, { requireAdmin: true });
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
      logger.error({ err: error }, "[inventory] failed to commit reservation");
      return c.json({ error: "Failed to commit reservation" }, 500);
    }
  });

  router.post("/reservations/:orderId/release", async (c) => {
    const authResponse = await enforceAuthorization(c, authenticateRequest, { requireAdmin: true });
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
      logger.error({ err: error }, "[inventory] failed to release reservation");
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
  authenticateRequest: RequestAuthenticator,
  options?: { requireAdmin?: boolean }
): Promise<Response | null> {
  try {
    const user = await authenticateRequest(c.req.raw);
    if (!user) {
      throw new AuthorizationError("Authentication required", 401);
    }
    if (options?.requireAdmin && !user.roles.includes("admin")) {
      throw new AuthorizationError("Admin role required", 403);
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

type RequestAuthenticator = (
  request: Request,
  options?: RequestAuthenticatorOptions
) => Promise<VerifiedAuthTokenPayload | null>;

type RequestAuthenticatorOptions = {
  optional?: boolean;
};

const createRequestAuthenticator = (options: VerifyAuthTokenOptions): RequestAuthenticator => {
  return async (request, authOptions = {}) => {
    const token = readBearerToken(request, { optional: authOptions.optional });
        logger.info('got bearer token as: ')
        logger.info(JSON.stringify(token));

    if (!token) {
      return null;
    }

    try {
      return await verifyAuthToken(token, options);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }
      throw new AuthorizationError("Invalid authentication token", 401);
    }
  };
};
