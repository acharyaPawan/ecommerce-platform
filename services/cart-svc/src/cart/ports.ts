import type { CartItem, CartSnapshot } from "./types.js";

export type PricingQuote = {
  sku: string;
  variantId?: string;
  selectedOptions?: Record<string, string>;
  unitPriceCents: number;
  currency: string;
  title?: string | null;
};

export interface PricingProvider {
  quote(items: CartItem[]): Promise<PricingQuote[]>;
}

export interface OrdersClient {
  placeOrder(snapshot: CartSnapshot): Promise<{ orderId: string }>;
}
