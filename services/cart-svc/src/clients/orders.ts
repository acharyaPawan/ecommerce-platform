import type { OrdersClient } from "../cart/ports.js";
import type { CartSnapshot } from "../cart/types.js";
import logger from "../logger.js";

type FetchFn = typeof fetch;

type OrdersClientOptions = {
  baseUrl: string;
  fetch?: FetchFn;
  timeoutMs?: number;
};

export class HttpOrdersClient implements OrdersClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchFn;
  private readonly timeoutMs: number;

  constructor(options: OrdersClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10000;
    logger.debug(`In http orders client, timeout is set to ${this.timeoutMs}`);
  }

  async placeOrder(snapshot: CartSnapshot): Promise<{ orderId: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": snapshot.snapshotId,
        },
        body: JSON.stringify({ cartSnapshot: snapshot }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Orders service responded with status ${response.status}`);
      }

      const payload = (await response.json()) as { orderId?: string };
      if (!payload.orderId) {
        throw new Error("Orders service response missing orderId");
      }

      return { orderId: payload.orderId };
    } finally {
      clearTimeout(timeout);
    }
  }
}
