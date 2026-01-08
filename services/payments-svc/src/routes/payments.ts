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
import type { PaymentsServiceConfig } from "../config.js";
import {
  authorizePayment,
  capturePayment,
  failPayment,
  listPayments,
  type PaymentRecord,
} from "../payments/service.js";

type PaymentsRouterDeps = {
  config: PaymentsServiceConfig;
};

export const createPaymentsRouter = ({ config }: PaymentsRouterDeps): Hono => {
  const router = new Hono();
  const verifyOptions = resolveVerifyAuthTokenOptions(config.auth);
  const authenticateRequest = createRequestAuthenticator(verifyOptions);

  router.post("/authorize", async (c) => {
    const auth = await authenticate(c, authenticateRequest);
    if (auth.response) {
      return auth.response;
    }

    const idempotencyKey = c.req.header("idempotency-key")?.trim();
    if (!idempotencyKey) {
      return c.json({ error: "Idempotency-Key header is required" }, 400);
    }

    const body = await readJson(c);
    if (!body.success) {
      return c.json({ error: body.error }, 400);
    }

    const parsed = authorizePaymentSchema.safeParse(body.data);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const correlationId = c.req.header("x-request-id")?.trim();

    try {
      const result = await authorizePayment(parsed.data, {
        idempotencyKey,
        correlationId,
      });
      c.header("x-idempotent-replay", result.idempotent ? "true" : "false");
      return c.json(
        { paymentId: result.paymentId, status: "authorized" },
        (result.idempotent ? 200 : 201) as ContentfulStatusCode
      );
    } catch (error) {
      console.error("[payments] failed to authorize payment", error);
      return c.json({ error: "Failed to authorize payment" }, 500);
    }
  });

  router.post("/:paymentId/fail", async (c) => {
    const auth = await authenticate(c, authenticateRequest);
    if (auth.response) {
      return auth.response;
    }

    const paymentId = c.req.param("paymentId")?.trim();
    if (!paymentId) {
      return c.json({ error: "Payment ID is required" }, 400);
    }

    const body = await readJson(c, { optional: true });
    if (!body.success) {
      return c.json({ error: body.error }, 400);
    }

    const parsed = failPaymentSchema.safeParse(body.data ?? {});
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const correlationId = c.req.header("x-request-id")?.trim();
    const result = await failPayment(paymentId, parsed.data.reason, { correlationId });

    if (result.status === "not_found") {
      return c.json({ error: "Payment not found" }, 404);
    }
    if (result.status === "already_finalized") {
      return c.json({ error: "Payment already finalized", payment: serializePayment(result.payment) }, 409);
    }

    return c.json({ status: "failed", payment: serializePayment(result.payment) });
  });

  router.post("/:paymentId/capture", async (c) => {
    const auth = await authenticate(c, authenticateRequest);
    if (auth.response) {
      return auth.response;
    }

    const paymentId = c.req.param("paymentId")?.trim();
    if (!paymentId) {
      return c.json({ error: "Payment ID is required" }, 400);
    }

    const correlationId = c.req.header("x-request-id")?.trim();
    const result = await capturePayment(paymentId, { correlationId });

    if (result.status === "not_found") {
      return c.json({ error: "Payment not found" }, 404);
    }
    if (result.status === "already_finalized") {
      return c.json({ error: "Payment already finalized", payment: serializePayment(result.payment) }, 409);
    }

    return c.json({ status: "captured", payment: serializePayment(result.payment) });
  });

  router.get("/", async (c) => {
    const auth = await authenticate(c, authenticateRequest);
    if (auth.response) {
      return auth.response;
    }

    const orderId = c.req.query("orderId")?.trim();
    const payments = await listPayments(orderId);

    return c.json({ items: payments.map(serializePayment) });
  });

  return router;
};

const authorizePaymentSchema = z.object({
  orderId: z.string().trim().min(1),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().trim().length(3),
});

const failPaymentSchema = z.object({
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

const serializePayment = (record: PaymentRecord) => ({
  id: record.id,
  orderId: record.orderId,
  status: record.status,
  amountCents: record.amountCents,
  currency: record.currency,
  failureReason: record.failureReason ?? null,
  failedAt: record.failedAt ? record.failedAt.toISOString() : null,
  capturedAt: record.capturedAt ? record.capturedAt.toISOString() : null,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});
