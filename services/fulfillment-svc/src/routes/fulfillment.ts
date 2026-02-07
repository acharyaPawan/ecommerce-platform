import { Hono } from "hono";
import type { Context } from "hono";
import {
  AuthorizationError,
  readBearerToken,
  resolveVerifyAuthTokenOptions,
  verifyAuthToken,
  type VerifiedAuthTokenPayload,
  type VerifyAuthTokenOptions,
} from "@ecommerce/core";
import type { FulfillmentService } from "../fulfillment/service.js";
import type { FulfillmentServiceConfig } from "../config.js";
import logger from "../logger.js";
import { z } from "zod";

type RouterDeps = {
  service: FulfillmentService;
  config: FulfillmentServiceConfig;
};

export const createFulfillmentRouter = ({ service, config }: RouterDeps): Hono => {
  const router = new Hono();
  const authenticateRequest = createRequestAuthenticator(config);

  router.get("/shipping/options", async (c) => {
    const result = service.getShippingOptions({
      country: c.req.query("country"),
      postalCode: c.req.query("postalCode"),
    });

    return c.json(result);
  });

  router.get("/shipments", async (c) => {
    const orderId = c.req.query("orderId")?.trim();
    if (!orderId) {
      return c.json({ error: "orderId query parameter is required" }, 400);
    }

    await authenticateRequest(c.req.raw, { optional: true });
    return c.json(service.getShipment(orderId));
  });

  router.post("/shipments", async (c) => {
    const payload = await readJson(c);
    if (!payload.success) {
      return c.json({ error: payload.error }, 400);
    }

    const parsed = createShipmentSchema.safeParse(payload.data);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    await authenticateRequest(c.req.raw, { optional: true });
    return c.json(
      {
        shipment: service.getShipment(parsed.data.orderId),
      },
      201
    );
  });

  return router;
};

const createShipmentSchema = z.object({
  orderId: z.string().trim().min(1),
});

type JsonResult =
  | { success: true; data: unknown }
  | { success: false; error: "Invalid JSON payload" };

async function readJson(c: Context): Promise<JsonResult> {
  const raw = await c.req.text();
  if (!raw.trim()) {
    return { success: false, error: "Invalid JSON payload" };
  }

  try {
    return { success: true, data: JSON.parse(raw) as unknown };
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }
}

type RequestAuthenticator = (
  request: Request,
  options?: RequestAuthenticatorOptions
) => Promise<VerifiedAuthTokenPayload | null>;

type RequestAuthenticatorOptions = {
  optional?: boolean;
};

const createRequestAuthenticator = (config: FulfillmentServiceConfig): RequestAuthenticator => {
  let options: VerifyAuthTokenOptions | null = null;
  try {
    options = resolveVerifyAuthTokenOptions(config.auth);
  } catch (error) {
    logger.warn(
      { err: error },
      "fulfillment.auth.config_missing_verifier_settings.using_optional_auth"
    );
  }

  return async (request, authOptions = {}) => {
    if (!options) {
      return null;
    }

    const token = readBearerToken(request, { optional: authOptions.optional });
    if (!token) {
      return null;
    }

    try {
      return await verifyAuthToken(token, options);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        logger.warn({ err: error }, "fulfillment.auth.denied");
        if (authOptions.optional) {
          return null;
        }
        throw error;
      }
      logger.warn({ err: error }, "fulfillment.auth.invalid_token");
      if (authOptions.optional) {
        return null;
      }
      throw new AuthorizationError("Invalid authentication token", 401);
    }
  };
};
