import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AuthorizationError, ensureScopes, type UserResolver } from "@ecommerce/core";
import { z } from "zod";
import { createProduct } from "../catalog/service.js";
import { createProductSchema } from "../catalog/schemas.js";
import { getProduct, listProducts } from "../catalog/queries.js";

type CatalogRouterDeps = {
  resolveUser: UserResolver;
};

export const createCatalogApi = ({ resolveUser }: CatalogRouterDeps): Hono => {
  const router = new Hono();

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
      console.error("[catalog] failed to list products", error);
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
      console.error("[catalog] failed to load product", error);
      return c.json({ error: "Failed to load product" }, 500);
    }
  });

  router.post("/products", async (c) => {
    try {
      const user = await resolveUser(c.req.raw);
      ensureScopes(user, ["catalog:write"]);
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
      console.error("[catalog] failed to create product", error);
      return c.json({ error: "Failed to create product" }, 500);
    }
  });

  return router;
};

const listProductsQuerySchema = z.object({
  status: z.enum(["draft", "published", "archived", "all"]).default("published"),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().min(1).optional(),
  q: z.string().trim().min(1).optional(),
});
