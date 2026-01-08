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
      return c.json({ error: "Idempotency-Key header is required" }, 400);
    }

    const body = await readJson(c);
    if (!body.success) {
      return c.json({ error: body.error }, 400);
    }

    const parsed = placeOrderSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const correlationId = c.req.header("x-request-id")?.trim();
    try {
      const result = await createOrder(parsed.data.cartSnapshot, {
        idempotencyKey,
        snapshotSecret: config.snapshotSecret,
        correlationId,
        reservationTtlSeconds: config.reservationTtlSeconds,
      });
      c.header("x-idempotent-replay", result.idempotent ? "true" : "false");
      return c.json({ orderId: result.orderId }, (result.idempotent ? 200 : 201) as ContentfulStatusCode);
    } catch (error) {
      if (error instanceof Error && error.message.includes("snapshot")) {
        console.warn("[orders] rejected snapshot", { message: error.message });
        return c.json({ error: "Invalid snapshot payload" }, 422);
      }
      console.error("[orders] failed to create order", error);
      return c.json({ error: "Failed to create order" }, 500);
    }
  });

  router.get("/:orderId", async (c) => {
    const auth = await authenticate(c, authenticateRequest);
    if (auth.response) {
      return auth.response;
    }

    const orderId = c.req.param("orderId")?.trim();
    if (!orderId) {
      return c.json({ error: "Order ID is required" }, 400);
    }

    const record = await getOrderById(orderId);
    if (!record) {
      return c.json({ error: "Order not found" }, 404);
    }

    const isAdmin = auth.user.roles.includes("admin");
    if (!isAdmin && record.userId && record.userId !== auth.user.userId) {
      return c.json({ error: "forbidden" }, 403);
    }

    return c.json(serializeOrder(record));
  });

  router.post("/:orderId/cancel", async (c) => {
    const auth = await authenticate(c, authenticateRequest);
    if (auth.response) {
      return auth.response;
    }

    const orderId = c.req.param("orderId")?.trim();
    if (!orderId) {
      return c.json({ error: "Order ID is required" }, 400);
    }

    const body = await readJson(c, { optional: true });
    if (!body.success) {
      return c.json({ error: body.error }, 400);
    }

    const parsed = cancelRequestSchema.safeParse(body.data ?? {});
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const existingOrder = await getOrderById(orderId);
    if (!existingOrder) {
      return c.json({ error: "Order not found" }, 404);
    }

    const isAdmin = auth.user.roles.includes("admin");
    if (!isAdmin) {
      if (!existingOrder.userId || existingOrder.userId !== auth.user.userId) {
        return c.json({ error: "forbidden" }, 403);
      }
    }

    const correlationId = c.req.header("x-request-id")?.trim();
    const result = await cancelOrder(orderId, parsed.data.reason, { correlationId });
    if (result.status === "not_found") {
      return c.json({ error: "Order not found" }, 404);
    }
    if (result.status === "already_finalized") {
      return c.json({ error: "Order already finalized", order: serializeOrder(result.order) }, 409);
    }

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
