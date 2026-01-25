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
import { createProduct } from "../catalog/service.js";
import { createProductSchema } from "../catalog/schemas.js";
import { getProduct, listProducts, quotePricing } from "../catalog/queries.js";
import logger from "../logger.js";

type CatalogRouterDeps = {
  auth: AuthConfig;
};

export const createCatalogApi = ({ auth }: CatalogRouterDeps): Hono => {
  const router = new Hono();
  const verifyOptions = resolveVerifyAuthTokenOptions(auth);
  const authenticateRequest = createRequestAuthenticator(verifyOptions);

  router.get("/products", async (c) => {
    const parsed = listProductsQuerySchema.safeParse({
      status: c.req.query("status"),
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
      q: c.req.query("q"),
    });

    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    try {
      const result = await listProducts({
        limit: parsed.data.limit,
        cursor: parsed.data.cursor,
        search: parsed.data.q,
        status: parsed.data.status === "all" ? undefined : parsed.data.status,
      });
      return c.json(result);
    } catch (error) {
      logger.error({ err: error }, "catalog.products.list_failed");
      return c.json({ error: "Failed to list products" }, 500);
    }
  });

  router.get("/products/:productId", async (c) => {
    const productId = c.req.param("productId");
    if (!productId?.trim()) {
      return c.json({ error: "Product ID is required" }, 400);
    }

    try {
      const product = await getProduct(productId);
      if (!product) {
        return c.json({ error: "Product not found" }, 404);
      }
      return c.json(product);
    } catch (error) {
      logger.error({ err: error, productId }, "catalog.products.load_failed");
      return c.json({ error: "Failed to load product" }, 500);
    }
  });

  router.post("/products", async (c) => {
    const authResponse = await requireAdmin(c, authenticateRequest);
    logger.debug({ isAuthorized: !authResponse }, "catalog.auth.admin_check");
    if (authResponse) {
      return authResponse;
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON payload" }, 400);
    }

    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "Validation failed",
          details: parsed.error.format(),
        },
        422
      );
    }

    try {
      const result = await createProduct(parsed.data, {
        correlationId: c.req.header("x-request-id") ?? undefined,
        idempotencyKey: c.req.header("idempotency-key") ?? undefined,
      });

      c.header("x-idempotent-replay", result.idempotent ? "true" : "false");

      return c.json(
        {
          productId: result.productId,
        },
        result.idempotent ? 200 : 201
      );
    } catch (error) {
      logger.error({ err: error }, "catalog.products.create_failed");
      return c.json({ error: "Failed to create product" }, 500);
    }
  });

  router.post("/pricing/quote", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON payload" }, 400);
    }

    const parsed = pricingQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    try {
      const quotes = await quotePricing(
        parsed.data.items.map((item) => ({
          sku: item.sku,
          variantId: item.variantId ?? null,
        }))
      );
      return c.json({ items: quotes });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to quote pricing";
      const status = message.includes("Variant not found") || message.includes("Missing price")
        ? 422
        : 500;
      return c.json({ error: message }, status as ContentfulStatusCode);
    }
  });

  return router;
};

async function requireAdmin(
  c: Context,
  authenticateRequest: RequestAuthenticator
): Promise<Response | null> {
  try {
    const user = await authenticateRequest(c.req.raw);
    if (!user) {
      throw new AuthorizationError("Authentication required", 401);
    }
    if (!user.roles.includes("admin")) {
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
      logger.debug("catalog.auth.token_missing");
      return null;
    }

    logger.debug({ hasToken: true }, "catalog.auth.token_received");

    try {
      const payload = await verifyAuthToken(token, options);
      logger.debug(
        { userId: payload.userId, roles: payload.roles },
        "catalog.auth.token_verified"
      );
      return payload;
    } catch (error) {
      logger.warn({ err: error }, "catalog.auth.token_invalid");
      if (error instanceof AuthorizationError) {
        throw error;
      }
      throw new AuthorizationError("Invalid authentication token", 401);
    }
  };
};

const listProductsQuerySchema = z.object({
  status: z.enum(["draft", "published", "archived", "all"]).default("published"),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().min(1).optional(),
  q: z.string().trim().min(1).optional(),
});

const pricingQuoteSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().trim().min(1),
        qty: z.coerce.number().int().positive().optional(),
        variantId: z.string().trim().min(1).optional(),
        selectedOptions: z.record(z.string(), z.string()).optional(),
      })
    )
    .min(1),
});
