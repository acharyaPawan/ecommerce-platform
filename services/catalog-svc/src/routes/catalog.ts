import { Hono } from "hono";
import { createProduct } from "../catalog/service.js";
import { createProductSchema } from "../catalog/schemas.js";

export const catalogApi = new Hono();

catalogApi.post("/products", async (c) => {
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
