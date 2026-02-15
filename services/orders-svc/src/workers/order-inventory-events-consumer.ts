import type { EventEnvelope } from "@ecommerce/events";
import { RabbitMqClient } from "@ecommerce/message-broker";
import {
  InventoryIntegrationEventType,
  stockReservationFailedEventSchema,
  stockReservedEventSchema,
  type StockReservationFailedEvent,
  type StockReservedEvent,
} from "../orders/inventory-events.js";
import {
  getOrderById,
  markOrderInventoryReservationFailed,
  markOrderInventoryReserved,
} from "../orders/service.js";
import logger from "../logger.js";

const WORKER_NAME = "[orders-inventory-consumer]";

export class OrderInventoryEventsConsumer {
  constructor(private readonly broker: RabbitMqClient, private readonly queueName: string) {}

  async start(): Promise<void> {
    logger.info(`${WORKER_NAME} initializing (queue=${this.queueName})`);
    await this.broker.subscribe({
      queue: this.queueName,
      routingKey: "inventory.stock.#",
      handler: this.onMessage,
    });
    logger.info(`${WORKER_NAME} listening for inventory reservation events`);
  }

  async stop(): Promise<void> {
    await this.broker.close();
  }

  private onMessage = async (event: EventEnvelope<Record<string, unknown>>): Promise<void> => {
    switch (event.type) {
      case InventoryIntegrationEventType.StockReservedV1:
        await this.handleStockReserved(stockReservedEventSchema.parse(event));
        break;
      case InventoryIntegrationEventType.StockReservationFailedV1:
        await this.handleStockReservationFailed(stockReservationFailedEventSchema.parse(event));
        break;
      default:
        logger.debug(`${WORKER_NAME} ignoring unsupported event type ${event.type}`);
    }
  };

  private async handleStockReserved(event: StockReservedEvent): Promise<void> {
    const result = await markOrderInventoryReserved({
      orderId: event.payload.orderId,
      messageId: event.id,
      source: event.type,
    });
    logger.info({ orderId: event.payload.orderId, result }, `${WORKER_NAME} stock_reserved_processed`);

    if (result === "updated") {
      await this.orchestratePaymentAndFulfillment(event).catch((error) => {
        logger.error(
          { err: error, orderId: event.payload.orderId },
          `${WORKER_NAME} downstream_orchestration_failed`
        );
      });
    }
  }

  private async handleStockReservationFailed(event: StockReservationFailedEvent): Promise<void> {
    const result = await markOrderInventoryReservationFailed({
      orderId: event.payload.orderId,
      reason: event.payload.reason,
      messageId: event.id,
      source: event.type,
    });
    logger.info(
      { orderId: event.payload.orderId, reason: event.payload.reason, result },
      `${WORKER_NAME} stock_reservation_failed_processed`
    );
  }

  private async orchestratePaymentAndFulfillment(event: StockReservedEvent): Promise<void> {
    const order = await getOrderById(event.payload.orderId);
    if (!order) {
      logger.warn({ orderId: event.payload.orderId }, `${WORKER_NAME} order_not_found_for_downstream`);
      return;
    }

    const amountCents = resolveOrderAmountCents(order);
    const currency = (order.currency || "USD").toUpperCase();
    const correlationId = event.correlationId ?? event.id;

    const paymentsServiceUrl = process.env.PAYMENTS_SERVICE_URL ?? "http://localhost:3007";
    const fulfillmentServiceUrl = process.env.FULFILLMENT_SERVICE_URL ?? "http://localhost:3009";
    const internalServiceSecret = process.env.INTERNAL_SERVICE_SECRET ?? "dev-internal-secret";

    await postJson({
      url: `${paymentsServiceUrl}/api/payments/internal/authorize-and-capture`,
      body: {
        orderId: order.id,
        amountCents,
        currency,
        correlationId,
      },
      internalServiceSecret,
    });

    await postJson({
      url: `${fulfillmentServiceUrl}/api/fulfillment/shipments`,
      body: { orderId: order.id },
      internalServiceSecret,
    });

    logger.info(
      { orderId: order.id, amountCents, currency },
      `${WORKER_NAME} downstream_orchestration_succeeded`
    );
  }
}

function resolveOrderAmountCents(order: Awaited<ReturnType<typeof getOrderById>>): number {
  if (!order) return 0;
  const totals = order.totals as Record<string, unknown>;
  const subtotal = totals?.subtotalCents;
  if (typeof subtotal === "number" && Number.isFinite(subtotal) && subtotal >= 0) {
    return Math.trunc(subtotal);
  }

  const snapshotTotals = (order.cartSnapshot as { totals?: { subtotalCents?: unknown } } | null)?.totals
    ?.subtotalCents;
  if (typeof snapshotTotals === "number" && Number.isFinite(snapshotTotals) && snapshotTotals >= 0) {
    return Math.trunc(snapshotTotals);
  }

  return 0;
}

async function postJson(input: {
  url: string;
  body: Record<string, unknown>;
  internalServiceSecret: string;
}): Promise<void> {
  const response = await fetch(input.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-service-secret": input.internalServiceSecret,
    },
    body: JSON.stringify(input.body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}) ${input.url}: ${text}`);
  }
}
