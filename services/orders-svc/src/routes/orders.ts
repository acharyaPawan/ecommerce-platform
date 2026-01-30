import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  AuthorizationError,
  readBearerToken,
  resolveVerifyAuthTokenOptions,
  verifyAuthToken,
  type VerifiedAuthTokenPayload,
  type VerifyAuthTokenOptions,
} from "@ecommerce/core";
import { z } from "zod";
import type { OrdersServiceConfig } from "../config.js";
import { cartSnapshotSchema } from "../orders/schemas.js";
import { cancelOrder, createOrder, getOrderById, type OrderRecord } from "../orders/service.js";
import logger from "../logger.js";

type OrdersRouterDeps = {
  config: OrdersServiceConfig;
};

export const createOrdersRouter = ({ config }: OrdersRouterDeps): Hono => {
  const router = new Hono();
  const verifyOptions = resolveVerifyAuthTokenOptions(config.auth);
  const authenticateRequest = createRequestAuthenticator(verifyOptions);

  router.post("/", async (c) => {
    const idempotencyKey = c.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) {
      logger.warn("orders.create.missing_idempotency_key");
      return c.json({ error: "Idempotency-Key header is required" }, 400);
    }

    logger.info({ idempotencyKey }, "orders.create.started");

    const body = await readJson(c);
    if (!body.success) {
      logger.warn({ error: body.error }, "orders.create.invalid_json");
      return c.json({ error: body.error }, 400);
    }

    const parsed = placeOrderSchema.safeParse(body.data);
    if (!parsed.success) {
      logger.warn({ errors: parsed.error.flatten() }, "orders.create.validation_failed");
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const correlationId = c.req.header("x-request-id")?.trim();
    try {
      logger.debug({ idempotencyKey, correlationId }, "orders.create.processing");
      const result = await createOrder(parsed.data.cartSnapshot, {
        idempotencyKey,
        snapshotSecret: config.snapshotSecret,
        correlationId,
        reservationTtlSeconds: config.reservationTtlSeconds,
      });
      logger.info({ orderId: result.orderId, idempotent: result.idempotent, correlationId }, "orders.create.success");
      c.header("x-idempotent-replay", result.idempotent ? "true" : "false");
      return c.json({ orderId: result.orderId }, (result.idempotent ? 200 : 201) as ContentfulStatusCode);
    } catch (error) {
      if (error instanceof Error && error.message.includes("snapshot")) {
        logger.warn({ err: error, correlationId }, "orders.create.snapshot_rejected");
        return c.json({ error: "Invalid snapshot payload" }, 422);
      }
      logger.error({ err: error, idempotencyKey, correlationId }, "orders.create_failed");
      return c.json({ error: "Failed to create order" }, 500);
    }
  });

  router.get("/:orderId", async (c) => {
    const orderId = c.req.param("orderId")?.trim();
    logger.debug({ orderId }, "orders.get.started");

    const auth = await authenticate(c, authenticateRequest);
    if (auth.response) {
      logger.warn({ orderId }, "orders.get.authentication_failed");
      return auth.response;
    }

    if (!orderId) {
      logger.warn("orders.get.missing_order_id");
      return c.json({ error: "Order ID is required" }, 400);
    }

    const record = await getOrderById(orderId);
    if (!record) {
      logger.info({ orderId }, "orders.get.not_found");
      return c.json({ error: "Order not found" }, 404);
    }

    const isAdmin = auth.user.roles.includes("admin");
    if (!isAdmin && record.userId && record.userId !== auth.user.userId) {
      logger.warn({ orderId, userId: auth.user.userId, recordUserId: record.userId }, "orders.get.forbidden");
      return c.json({ error: "forbidden" }, 403);
    }

    logger.info({ orderId, userId: auth.user.userId }, "orders.get.success");
    return c.json(serializeOrder(record));
  });

  router.post("/:orderId/cancel", async (c) => {
    const orderId = c.req.param("orderId")?.trim();
    logger.debug({ orderId }, "orders.cancel.started");

    const auth = await authenticate(c, authenticateRequest);
    if (auth.response) {
      logger.warn({ orderId }, "orders.cancel.authentication_failed");
      return auth.response;
    }

    if (!orderId) {
      logger.warn("orders.cancel.missing_order_id");
      return c.json({ error: "Order ID is required" }, 400);
    }

    const body = await readJson(c, { optional: true });
    if (!body.success) {
      logger.warn({ error: body.error }, "orders.cancel.invalid_json");
      return c.json({ error: body.error }, 400);
    }

    const parsed = cancelRequestSchema.safeParse(body.data ?? {});
    if (!parsed.success) {
      logger.warn({ errors: parsed.error.flatten() }, "orders.cancel.validation_failed");
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const existingOrder = await getOrderById(orderId);
    if (!existingOrder) {
      logger.info({ orderId }, "orders.cancel.not_found");
      return c.json({ error: "Order not found" }, 404);
    }

    const isAdmin = auth.user.roles.includes("admin");
    if (!isAdmin) {
      if (!existingOrder.userId || existingOrder.userId !== auth.user.userId) {
        logger.warn({ orderId, userId: auth.user.userId }, "orders.cancel.forbidden");
        return c.json({ error: "forbidden" }, 403);
      }
    }

    const correlationId = c.req.header("x-request-id")?.trim();
    logger.info({ orderId, reason: parsed.data.reason, correlationId }, "orders.cancel.processing");
    const result = await cancelOrder(orderId, parsed.data.reason, { correlationId });
    
    if (result.status === "not_found") {
      logger.warn({ orderId }, "orders.cancel.race_condition_not_found");
      return c.json({ error: "Order not found" }, 404);
    }
    if (result.status === "already_finalized") {
      logger.info({ orderId }, "orders.cancel.already_finalized");
      return c.json({ error: "Order already finalized", order: serializeOrder(result.order) }, 409);
    }

    logger.info({ orderId, correlationId }, "orders.cancel.success");
    return c.json({ status: "canceled", order: serializeOrder(result.order) });
  });

  return router;
};

const placeOrderSchema = z.object({
  cartSnapshot: cartSnapshotSchema,
});

const cancelRequestSchema = z.object({
  reason: z.string().trim().min(1).optional(),
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

type AuthResult =
  | { user: VerifiedAuthTokenPayload; response?: undefined }
  | { user: null; response: Response };

async function authenticate(
  c: Context,
  authenticateRequest: RequestAuthenticator
): Promise<AuthResult> {
  try {
    const user = await authenticateRequest(c.req.raw);
    if (!user) {
      throw new AuthorizationError("Authentication required", 401);
    }
    return { user };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.debug({ status: error.status, message: error.message }, "orders.auth.failed");
      return {
        user: null,
        response: c.json(
          {
            error: error.status === 401 ? "unauthorized" : "forbidden",
            message: error.message,
          },
          error.status as ContentfulStatusCode
        ),
      };
    }
    throw error;
  }
}

const serializeOrder = (record: OrderRecord) => ({
  id: record.id,
  status: record.status,
  currency: record.currency,
  userId: record.userId,
  totals: record.totals,
  cartSnapshot: record.cartSnapshot,
  cancellationReason: record.cancellationReason ?? null,
  canceledAt: record.canceledAt ? record.canceledAt.toISOString() : null,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
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
    if (!token) {
      logger.debug("orders.auth.no_token");
      return null;
    }

    try {
      return await verifyAuthToken(token, options);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }
      logger.warn({ err: error }, "orders.auth.token_verification_failed");
      throw new AuthorizationError("Invalid authentication token", 401);
    }
  };
};
