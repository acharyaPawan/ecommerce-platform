import type { CartItem } from "../cart/types.js";
import type { PricingProvider, PricingQuote } from "../cart/ports.js";

type FetchFn = typeof fetch;

type CatalogPricingClientOptions = {
  baseUrl: string;
  fetch?: FetchFn;
  timeoutMs?: number;
};

type QuoteResponse = {
  items?: Array<{
    sku: string;
    variantId?: string;
    selectedOptions?: Record<string, string>;
    unitPriceCents: number;
    currency: string;
    title?: string | null;
  }>;
};

export class HttpCatalogPricingProvider implements PricingProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchFn;
  private readonly timeoutMs: number;

  constructor(options: CatalogPricingClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async quote(items: CartItem[]): Promise<PricingQuote[]> {
    if (items.length === 0) {
      return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/catalog/pricing/quote`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            sku: item.sku,
            qty: item.qty,
            variantId: item.variantId ?? undefined,
            selectedOptions: item.selectedOptions,
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Catalog pricing responded with status ${response.status}`);
      }

      const payload = (await response.json()) as QuoteResponse;
      return (payload.items ?? []).map((item) => ({
        sku: item.sku,
        variantId: item.variantId,
        selectedOptions: item.selectedOptions,
        unitPriceCents: item.unitPriceCents,
        currency: item.currency,
        title: item.title ?? null,
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}
