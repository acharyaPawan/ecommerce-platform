import { createHmac, randomUUID } from "node:crypto";
import { CartCheckoutError, CartItemNotFoundError, CartNotFoundError, CartValidationError } from "./errors.js";
import type { CartStore } from "./store.js";
import type {
  Cart,
  CartItem,
  CartSnapshot,
  CartSnapshotItem,
  CartPricingSnapshot,
} from "./types.js";
import { computeCartTotals } from "./types.js";
import type { PricingProvider, OrdersClient, PricingQuote } from "./ports.js";
import type { AddItemPayload, CheckoutPayload, ItemTargetPayload, UpdateItemPayload } from "./validation.js";
import logger from "../logger.js";

export type CartContext = {
  cartId?: string;
  userId?: string;
  currency?: string;
};

export type CartServiceOptions = {
  defaultCurrency: string;
  maxQtyPerItem: number;
  snapshotSecret: string;
  pricingProvider?: PricingProvider;
  ordersClient?: OrdersClient;
};

export type CartOperationResult = {
  cart: Cart;
  cartWasCreated: boolean;
};

export type CartCheckoutResult = {
  snapshot: CartSnapshot;
  cart: Cart;
  orderId?: string;
};

type ResolvedCart = {
  cart: Cart;
  newlyCreated: boolean;
};

type ResolveOptions = {
  createForUser?: boolean;
  allowAnonymousCreation?: boolean;
  currencyOverride?: string;
};

export class CartService {
  constructor(
    private readonly store: CartStore,
    private readonly options: CartServiceOptions
  ) {}

  async getCart(context: CartContext): Promise<Cart> {
    const resolved = await this.resolveCart(context, {
      createForUser: Boolean(context.userId),
    });
    return resolved.cart;
  }

  async addItem(context: CartContext, payload: AddItemPayload): Promise<CartOperationResult> {
    const { cart, newlyCreated } = await this.resolveCart(context, {
      createForUser: true,
      allowAnonymousCreation: !context.cartId,
      currencyOverride: payload.currency?.toUpperCase(),
    });
    const normalizedItem = this.normalizeItem(payload);

    const updated = await this.store.updateCart(cart.id, (current) => {
      const base = current ?? cart;
      const items = [...base.items];
      const existingIndex = items.findIndex((item) => this.buildItemKey(item) === this.buildItemKey(normalizedItem));

      if (existingIndex >= 0) {
        const nextQty = items[existingIndex].qty + normalizedItem.qty;
        if (nextQty > this.options.maxQtyPerItem) {
          throw new CartValidationError(`Quantity cannot exceed ${this.options.maxQtyPerItem}`);
        }
        items[existingIndex] = {
          ...items[existingIndex],
          qty: nextQty,
        };
      } else {
        items.push(normalizedItem);
      }

      return {
        ...base,
        userId: base.userId ?? context.userId ?? null,
        status: "active",
        pricingSnapshot: null,
        items,
      };
    });

    if (!updated) {
      throw new CartNotFoundError();
    }

    return {
      cart: updated,
      cartWasCreated: newlyCreated && cart.items.length === 0,
    };
  }

  async updateItemQuantity(
    context: CartContext,
    sku: string,
    payload: UpdateItemPayload
  ): Promise<Cart> {
    const { cart } = await this.resolveCart(context);
    const targetSku = normalizeSku(sku);

    const updated = await this.store.updateCart(cart.id, (current) => {
      if (!current) {
        throw new CartNotFoundError();
      }

      const index = this.findItemIndex(current.items, targetSku, payload);
      if (index === -1) {
        throw new CartItemNotFoundError();
      }

      const items = [...current.items];
      const existing = items[index];
      const nextQty =
        typeof payload.delta === "number" ? existing.qty + payload.delta : payload.qty ?? existing.qty;

      if (nextQty < 0) {
        throw new CartValidationError("Quantity cannot be negative");
      }

      if (nextQty === 0) {
        items.splice(index, 1);
      } else if (nextQty > this.options.maxQtyPerItem) {
        throw new CartValidationError(`Quantity cannot exceed ${this.options.maxQtyPerItem}`);
      } else {
        items[index] = { ...existing, qty: nextQty };
      }

      return {
        ...current,
        status: "active",
        pricingSnapshot: null,
        items,
      };
    });

    if (!updated) {
      throw new CartNotFoundError();
    }

    return updated;
  }

  async removeItem(context: CartContext, sku: string, target?: ItemTargetPayload): Promise<Cart> {
    const { cart } = await this.resolveCart(context);
    const normalizedSku = normalizeSku(sku);

    const updated = await this.store.updateCart(cart.id, (current) => {
      if (!current) {
        throw new CartNotFoundError();
      }

      const index = this.findItemIndex(current.items, normalizedSku, target);
      if (index === -1) {
        throw new CartItemNotFoundError();
      }

      const items = current.items.filter((_, idx) => idx !== index);

      return {
        ...current,
        status: items.length > 0 ? current.status : "active",
        pricingSnapshot: null,
        items,
      };
    });

    if (!updated) {
      throw new CartNotFoundError();
    }

    return updated;
  }

  async mergeCarts(userId: string, anonymousCartId: string): Promise<Cart> {
    const anonymousCart = await this.store.getCart(anonymousCartId);
    if (!anonymousCart || anonymousCart.items.length === 0) {
      const { cart } = await this.resolveCart({ userId }, { createForUser: true });
      return cart;
    }

    const { cart } = await this.resolveCart({ userId }, { createForUser: true });

    const updated = await this.store.updateCart(cart.id, (current) => {
      const base = current ?? cart;

      const mergedItems = [...base.items];
      for (const item of anonymousCart.items) {
        const idx = mergedItems.findIndex((candidate) => this.buildItemKey(candidate) === this.buildItemKey(item));
        if (idx >= 0) {
          const nextQty = Math.min(
            this.options.maxQtyPerItem,
            mergedItems[idx].qty + item.qty
          );
          mergedItems[idx] = { ...mergedItems[idx], qty: nextQty };
        } else {
          mergedItems.push(item);
        }
      }

      return {
        ...base,
        userId,
        pricingSnapshot: null,
        status: "active",
        items: mergedItems,
      };
    });

    if (!updated) {
      throw new CartNotFoundError();
    }

    await this.store.deleteCart(anonymousCartId);

    return updated;
  }

  async checkout(context: CartContext, _payload: CheckoutPayload): Promise<CartCheckoutResult> {
    const { cart } = await this.resolveCart(context);

    if (cart.items.length === 0) {
      throw new CartCheckoutError("Cart is empty");
    }

    const { items: pricedItems, pricingSnapshot } = await this.computePricingSnapshot(cart);
    const snapshot = this.buildSnapshot(cart, pricedItems, pricingSnapshot);

    let orderId: string | undefined;
    if (this.options.ordersClient) {
      try {
        const result = await this.options.ordersClient.placeOrder(snapshot);
        orderId = result.orderId;
      } catch (error) {
        logger.warn({ err: error }, "cart.orders.place_failed");
      }
    }

    const clearedCart = await this.store.updateCart(cart.id, (current) => {
      if (!current) {
        throw new CartNotFoundError();
      }

      return {
        ...current,
        items: [],
        pricingSnapshot: pricingSnapshot ?? null,
        status: "checked_out",
      };
    });

    if (!clearedCart) {
      throw new CartCheckoutError("Failed to finalize cart");
    }

    return {
      snapshot,
      cart: clearedCart,
      orderId,
    };
  }

  private async computePricingSnapshot(cart: Cart): Promise<{
    items: CartSnapshotItem[];
    pricingSnapshot: CartPricingSnapshot | null;
  }> {
    if (!this.options.pricingProvider) {
      return {
        items: cart.items.map((item) => ({ ...item })),
        pricingSnapshot: null,
      };
    }

    let quotes: PricingQuote[];
    try {
      quotes = await this.options.pricingProvider.quote(cart.items);
    } catch (error) {
      logger.error({ err: error }, "cart.pricing.quote_failed");
      throw new CartCheckoutError("Failed to refresh pricing");
    }

    const normalizedQuotes = quotes.map((quote) => ({
      ...quote,
      sku: normalizeSku(quote.sku),
      variantId: normalizeNullable(quote.variantId),
      selectedOptions: normalizeSelectedOptions(quote.selectedOptions),
    }));

    const priceByKey = new Map(normalizedQuotes.map((quote) => [this.buildItemKey(quote), quote]));
    const pricedItems: CartSnapshotItem[] = [];
    let currency: string | null = null;
    let subtotalCents = 0;

    for (const item of cart.items) {
      const key = this.buildItemKey(item);
      const quote = priceByKey.get(key);
      if (!quote) {
        throw new CartCheckoutError(`Missing pricing for SKU ${item.sku}`);
      }
      if (currency && quote.currency !== currency) {
        throw new CartCheckoutError("Pricing currency mismatch detected");
      }
      currency = currency ?? quote.currency;

      pricedItems.push({
        ...item,
        unitPriceCents: quote.unitPriceCents,
        currency: quote.currency,
        title: quote.title ?? null,
      });
      subtotalCents += quote.unitPriceCents * item.qty;
    }

    const totals = computeCartTotals(cart);
    const pricingSnapshot: CartPricingSnapshot = {
      subtotalCents,
      currency: currency ?? cart.currency,
      itemCount: totals.itemCount,
      totalQuantity: totals.totalQuantity,
      computedAt: new Date().toISOString(),
    };

    return {
      items: pricedItems,
      pricingSnapshot,
    };
  }

  private async resolveCart(context: CartContext, options: ResolveOptions = {}): Promise<ResolvedCart> {
    const currency = (options.currencyOverride ?? context.currency ?? this.options.defaultCurrency).toUpperCase();

    if (context.userId) {
      const existingId = await this.store.getCartIdByUser(context.userId);
      if (existingId) {
        const existingCart = await this.store.getCart(existingId);
        if (existingCart) {
          return { cart: existingCart, newlyCreated: false };
        }
        await this.store.clearUserCart(context.userId);
      }

      if (!options.createForUser) {
        throw new CartNotFoundError();
      }

      const cart = await this.store.createCart({
        userId: context.userId,
        currency,
      });
      return { cart, newlyCreated: true };
    }

    if (context.cartId) {
      const cart = await this.store.getCart(context.cartId);
      if (!cart) {
        throw new CartNotFoundError();
      }
      return { cart, newlyCreated: false };
    }

    if (options.allowAnonymousCreation) {
      const cart = await this.store.createCart({ currency });
      return { cart, newlyCreated: true };
    }

    throw new CartNotFoundError();
  }

  private normalizeItem(input: Pick<AddItemPayload, "sku" | "qty" | "variantId" | "selectedOptions">): CartItem {
    const sku = normalizeSku(input.sku);
    const qty = input.qty;
    if (qty > this.options.maxQtyPerItem) {
      throw new CartValidationError(`Quantity cannot exceed ${this.options.maxQtyPerItem}`);
    }

    return {
      sku,
      qty,
      variantId: normalizeNullable(input.variantId),
      selectedOptions: normalizeSelectedOptions(input.selectedOptions),
    };
  }

  private findItemIndex(items: CartItem[], sku: string, target?: ItemTargetPayload): number {
    const normalizedTarget = {
      variantId: normalizeNullable(target?.variantId),
      selectedOptions: normalizeSelectedOptions(target?.selectedOptions),
    };
    const key = this.buildItemKey({
      sku,
      variantId: normalizedTarget.variantId,
      selectedOptions: normalizedTarget.selectedOptions,
    });
    return items.findIndex((item) => this.buildItemKey(item) === key);
  }

  private buildItemKey(item: Pick<CartItem, "sku" | "variantId" | "selectedOptions">): string {
    const variant = item.variantId?.toLowerCase() ?? "";
    const options = item.selectedOptions
      ? Object.entries(item.selectedOptions)
          .map(([key, value]) => `${key}:${value}`)
          .join("|")
      : "";
    return `${item.sku.toLowerCase()}|${variant}|${options}`;
  }

  private buildSnapshot(
    cart: Cart,
    items: CartSnapshotItem[],
    pricingSnapshot: CartPricingSnapshot | null
  ): CartSnapshot {
    const totals = computeCartTotals(cart);
    const snapshotBase = {
      snapshotId: randomUUID(),
      cartId: cart.id,
      cartVersion: cart.version,
      currency: cart.currency,
      items,
      totals: {
        ...totals,
        subtotalCents: pricingSnapshot?.subtotalCents ?? null,
        currency: pricingSnapshot?.currency ?? cart.currency,
      },
      createdAt: new Date().toISOString(),
      userId: cart.userId ?? null,
      pricingSnapshot,
    };

    const signature = createHmac("sha256", this.options.snapshotSecret)
      .update(JSON.stringify(snapshotBase))
      .digest("hex");

    return {
      ...snapshotBase,
      signature,
    };
  }
}

function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeNullable(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSelectedOptions(
  options?: Record<string, string>
): Record<string, string> | undefined {
  if (!options) {
    return undefined;
  }

  const entries = Object.entries(options)
    .map(([key, value]) => [key.trim().toLowerCase(), value.trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}
