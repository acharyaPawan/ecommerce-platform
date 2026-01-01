import { Hono } from "hono";
import type { Context } from "hono";
import type { CartService, CartContext } from "../cart/service.js";
import type { Cart } from "../cart/types.js";
import { computeCartTotals } from "../cart/types.js";
import {
  cartContextSchema,
  checkoutSchema,
  createAddItemSchema,
  createUpdateItemSchema,
  itemTargetSchema,
  type ItemTargetPayload,
} from "../cart/validation.js";
import type { ServiceConfig } from "../config.js";
import {
  CartCheckoutError,
  CartConcurrencyError,
  CartError,
  CartItemNotFoundError,
  CartNotFoundError,
  CartValidationError,
} from "../cart/errors.js";
import type { IdempotencyStore, StoredIdempotentResponse } from "../infra/idempotency-store.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type CartRouterDeps = {
  cartService: CartService;
  idempotencyStore: IdempotencyStore;
  config: ServiceConfig;
};

export function createCartRouter({ cartService, idempotencyStore, config }: CartRouterDeps): Hono {
  const router = new Hono();
  const addItemSchema = createAddItemSchema(config.maxQtyPerItem);
  const updateItemSchema = createUpdateItemSchema(config.maxQtyPerItem);

  router.get("/", async (c) => {
    const context = parseCartContext(c);
    if (!context.cartId && !context.userId) {
      return c.json({ error: "Provide X-Cart-Id or Authorization" }, 400);
    }

    try {
      const cart = await cartService.getCart(context);
      const payload = buildCartResponse(cart);
      setCartHeaders(c, cart);
      return c.json(payload);
    } catch (error) {
      return mapCartError(c, error);
    }
  });

  router.post("/items", async (c) => {
    const json = await readJson(c);
    if (!json.success) {
      return c.json({ error: json.error }, 400);
    }
    const parsed = addItemSchema.safeParse(json.data);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const context = parseCartContext(c);
    const idempotencyKey = readIdempotencyKey(c);
    if (!idempotencyKey) {
      return c.json({ error: "Idempotency-Key header is required" }, 400);
    }
    const replay = await readStoredResponse(idempotencyStore, buildRequestScopes(context), idempotencyKey);
    if (replay) {
      return respondFromStored(c, replay);
    }

    try {
      const result = await cartService.addItem(context, parsed.data);
      return await respondWithCart(c, context, result.cart, {
        status: result.cartWasCreated ? 201 : 200,
        idempotency: { key: idempotencyKey, store: idempotencyStore },
      });
    } catch (error) {
      return mapCartError(c, error);
    }
  });

  router.patch("/items/:sku", async (c) => {
    const json = await readJson(c);
    if (!json.success) {
      return c.json({ error: json.error }, 400);
    }
    const parsed = updateItemSchema.safeParse(json.data);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const context = parseCartContext(c);
    const idempotencyKey = readIdempotencyKey(c);
    if (!idempotencyKey) {
      return c.json({ error: "Idempotency-Key header is required" }, 400);
    }

    const replay = await readStoredResponse(idempotencyStore, buildRequestScopes(context), idempotencyKey);
    if (replay) {
      return respondFromStored(c, replay);
    }

    try {
      const cart = await cartService.updateItemQuantity(context, c.req.param("sku"), parsed.data);
      return await respondWithCart(c, context, cart, {
        idempotency: { key: idempotencyKey, store: idempotencyStore },
      });
    } catch (error) {
      return mapCartError(c, error);
    }
  });

  router.delete("/items/:sku", async (c) => {
    const body = await readJson(c, { optional: true });
    if (!body.success) {
      return c.json({ error: body.error }, 400);
    }

    let target: ItemTargetPayload | undefined;
    if (body.data) {
      const parsed = itemTargetSchema.safeParse(body.data);
      if (!parsed.success) {
        return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
      }
      target = parsed.data;
    }

    const context = parseCartContext(c);
    const idempotencyKey = readIdempotencyKey(c);
    if (!idempotencyKey) {
      return c.json({ error: "Idempotency-Key header is required" }, 400);
    }

    const replay = await readStoredResponse(idempotencyStore, buildRequestScopes(context), idempotencyKey);
    if (replay) {
      return respondFromStored(c, replay);
    }

    try {
      const cart = await cartService.removeItem(context, c.req.param("sku"), target);
      return await respondWithCart(c, context, cart, {
        idempotency: { key: idempotencyKey, store: idempotencyStore },
      });
    } catch (error) {
      return mapCartError(c, error);
    }
  });

  router.post("/merge", async (c) => {
    const context = parseCartContext(c);
    if (!context.userId) {
      return c.json({ error: "Authorization header is required for merge" }, 400);
    }
    if (!context.cartId) {
      return c.json({ error: "X-Cart-Id header is required for merge" }, 400);
    }

    const idempotencyKey = readIdempotencyKey(c);
    if (!idempotencyKey) {
      return c.json({ error: "Idempotency-Key header is required" }, 400);
    }

    const replay = await readStoredResponse(idempotencyStore, buildRequestScopes(context), idempotencyKey);
    if (replay) {
      return respondFromStored(c, replay);
    }

    try {
      const cart = await cartService.mergeCarts(context.userId, context.cartId);
      return await respondWithCart(c, context, cart, {
        idempotency: { key: idempotencyKey, store: idempotencyStore },
      });
    } catch (error) {
      return mapCartError(c, error);
    }
  });

  router.post("/checkout", async (c) => {
    const json = await readJson(c, { optional: true });
    if (!json.success) {
      return c.json({ error: json.error }, 400);
    }
    const parsed = checkoutSchema.safeParse(json.data ?? {});
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const context = parseCartContext(c);
    if (!context.cartId && !context.userId) {
      return c.json({ error: "Provide X-Cart-Id or Authorization" }, 400);
    }

    const idempotencyKey = readIdempotencyKey(c);
    if (!idempotencyKey) {
      return c.json({ error: "Idempotency-Key header is required" }, 400);
    }

    const replay = await readStoredResponse(idempotencyStore, buildRequestScopes(context), idempotencyKey);
    if (replay) {
      return respondFromStored(c, replay);
    }

    try {
      const result = await cartService.checkout(context, parsed.data);
      const response = {
        snapshot: result.snapshot,
      };
      const status: ContentfulStatusCode = 200;
      setCartHeaders(c, result.cart);
      await storeIdempotentResponse(
        idempotencyStore,
        buildResponseScopes(context, result.cart),
        idempotencyKey,
        {
          statusCode: status,
          body: response,
          headers: buildCartHeaders(result.cart),
        }
      );
      c.header("x-idempotent-replay", "false");
      return c.json(response, status);
    } catch (error) {
      return mapCartError(c, error);
    }
  });

  return router;
}

function parseCartContext(c: Context): CartContext {
  const headers = cartContextSchema.safeParse({
    cartId: c.req.header("x-cart-id")?.trim(),
    userId: extractUserId(c),
    currency: c.req.header("x-cart-currency")?.trim(),
  });

  if (!headers.success) {
    return {};
  }

  return headers.data;
}

function extractUserId(c: Context): string | undefined {
  const header = c.req.header("authorization") ?? c.req.header("x-user-id");
  if (!header) {
    return undefined;
  }

  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || undefined;
  }

  return header.trim() || undefined;
}

function readIdempotencyKey(c: Context): string | undefined {
  return c.req.header("idempotency-key")?.trim();
}

async function respondWithCart(
  c: Context,
  originalContext: CartContext,
  cart: Cart,
  options: {
    status?: ContentfulStatusCode;
    idempotency?: { key: string; store: IdempotencyStore };
  } = {}
) {
  const payload = buildCartResponse(cart);
  const status: ContentfulStatusCode = options.status ?? 200;
  const headers = buildCartHeaders(cart);
  setCartHeaders(c, cart);

  if (options.idempotency) {
    await storeIdempotentResponse(
      options.idempotency.store,
      buildResponseScopes(originalContext, cart),
      options.idempotency.key,
      { statusCode: status, body: payload, headers }
    );
    c.header("x-idempotent-replay", "false");
  }

  return c.json(payload, status);
}

function setCartHeaders(c: Context, cart: Cart): void {
  const headers = buildCartHeaders(cart);
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value);
  }
  c.header("cache-control", "no-store");
}

function buildCartHeaders(cart: Cart): Record<string, string> {
  return {
    "x-cart-id": cart.id,
    "x-cart-version": `${cart.version}`,
    etag: `"${cart.version}"`,
  };
}

function buildCartResponse(cart: Cart) {
  return {
    id: cart.id,
    userId: cart.userId,
    currency: cart.currency,
    status: cart.status,
    version: cart.version,
    items: cart.items,
    totals: computeCartTotals(cart),
    pricingSnapshot: cart.pricingSnapshot,
    updatedAt: cart.updatedAt,
    createdAt: cart.createdAt,
    appliedCoupon: cart.appliedCoupon,
  };
}

async function readJson(
  c: Context,
  options: { optional?: boolean } = {}
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  const contentLength = c.req.header("content-length");
  if (
    options.optional &&
    (!contentLength || contentLength === "0") &&
    !c.req.header("transfer-encoding")
  ) {
    return { success: true, data: undefined };
  }

  try {
    const body = await c.req.json();
    return { success: true, data: body };
  } catch {
    if (options.optional) {
      return { success: true, data: undefined };
    }
    return { success: false, error: "Invalid JSON payload" };
  }
}

function mapCartError(c: Context, error: unknown) {
  if (error instanceof CartNotFoundError || error instanceof CartItemNotFoundError) {
    return c.json({ error: error.message, code: error.code }, 404);
  }
  if (error instanceof CartValidationError) {
    return c.json({ error: error.message, code: error.code, details: error.details }, 422);
  }
  if (error instanceof CartCheckoutError) {
    return c.json({ error: error.message, code: error.code }, 400);
  }
  if (error instanceof CartConcurrencyError) {
    return c.json({ error: error.message, code: error.code }, 409);
  }
  if (error instanceof CartError) {
    return c.json({ error: error.message, code: error.code }, 400);
  }

  console.error("[cart-svc] unhandled error", error);
  return c.json({ error: "Unexpected error" }, 500);
}

async function readStoredResponse(
  store: IdempotencyStore,
  scopes: string[],
  key: string
): Promise<StoredIdempotentResponse | null> {
  for (const scope of scopes) {
    const existing = await store.get(scope, key);
    if (existing) {
      return existing;
    }
  }
  return null;
}

async function storeIdempotentResponse(
  store: IdempotencyStore,
  scopes: string[],
  key: string,
  response: Omit<StoredIdempotentResponse, "storedAt">
): Promise<void> {
  const uniqueScopes = Array.from(new Set(scopes));
  await Promise.all(uniqueScopes.map((scope) => store.set(scope, key, response)));
}

function respondFromStored(c: Context, stored: StoredIdempotentResponse) {
  if (stored.headers) {
    for (const [key, value] of Object.entries(stored.headers)) {
      c.header(key, value);
    }
  }
  c.header("cache-control", "no-store");
  c.header("x-idempotent-replay", "true");
  return c.json(stored.body, stored.statusCode);
}

function buildRequestScopes(context: CartContext): string[] {
  const scopes: string[] = [];
  if (context.userId) {
    scopes.push(`user:${context.userId}`);
  }
  if (context.cartId) {
    scopes.push(`cart:${context.cartId}`);
  }
  if (scopes.length === 0) {
    scopes.push("anonymous");
  }
  return scopes;
}

function buildResponseScopes(context: CartContext, cart: Cart): string[] {
  const scopes = new Set<string>();
  if (cart.userId) {
    scopes.add(`user:${cart.userId}`);
  }
  scopes.add(`cart:${cart.id}`);
  if (!context.userId && !context.cartId) {
    scopes.add("anonymous");
  }
  return Array.from(scopes);
}
