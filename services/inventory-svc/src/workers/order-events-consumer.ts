import type { EventEnvelope } from "@ecommerce/events";
import { RabbitMqClient } from "@ecommerce/message-broker";
import {
  OrderIntegrationEventType,
  orderPlacedEventSchema,
  paymentAuthorizedEventSchema,
  orderCanceledEventSchema,
  paymentFailedEventSchema,
  type OrderPlacedEvent,
  type PaymentAuthorizedEvent,
  type OrderCanceledEvent,
  type PaymentFailedEvent,
} from "../inventory/order-events.js";
import {
  commitReservation,
  releaseReservation,
  reserveStock,
} from "../inventory/service.js";

const WORKER_NAME = "[inventory-order-consumer]";

export class OrderEventsConsumer {
  constructor(private readonly broker: RabbitMqClient, private readonly queueName: string) {}

  async start(): Promise<void> {
    console.log(`${WORKER_NAME} initializing (queue=${this.queueName})`);
    await this.broker.subscribe({
      queue: this.queueName,
      routingKey: "orders.#",
      handler: this.onMessage,
    });
    await this.broker.subscribe({
      queue: this.queueName,
      routingKey: "payments.#",
      handler: this.onMessage,
    });
    console.log(`${WORKER_NAME} listening for order + payment events`);
  }

  async stop(): Promise<void> {
    await this.broker.close();
  }

  private onMessage = async (event: EventEnvelope<Record<string, unknown>>): Promise<void> => {
    switch (event.type) {
      case OrderIntegrationEventType.OrderPlacedV1:
        await this.handleOrderPlaced(orderPlacedEventSchema.parse(event));
        break;
      case OrderIntegrationEventType.PaymentAuthorizedV1:
        await this.handlePaymentAuthorized(paymentAuthorizedEventSchema.parse(event));
        break;
      case OrderIntegrationEventType.OrderCanceledV1:
        await this.handleOrderCanceled(orderCanceledEventSchema.parse(event));
        break;
      case OrderIntegrationEventType.PaymentFailedV1:
        await this.handlePaymentFailed(paymentFailedEventSchema.parse(event));
        break;
      default:
        console.warn(`${WORKER_NAME} skipping unsupported event type ${event.type}`);
    }
  };

  private async handleOrderPlaced(event: OrderPlacedEvent): Promise<void> {
    const result = await reserveStock(
      {
        orderId: event.payload.orderId,
        items: event.payload.items,
        ttlSeconds: event.payload.ttlSeconds,
      },
      {
        correlationId: event.correlationId,
        causationId: event.id,
        messageId: event.id,
        source: event.type,
      }
    );

    if (result.status === "duplicate") {
      console.log(`${WORKER_NAME} duplicate OrderPlaced ${event.payload.orderId}`);
      return;
    }

    if (result.status === "failed") {
      console.warn(
        `${WORKER_NAME} reservation failed for ${event.payload.orderId} (${result.reason})`
      );
      return;
    }

    console.log(
      `${WORKER_NAME} reserved stock for ${event.payload.orderId} (items=${result.items.length})`
    );
  }

  private async handlePaymentAuthorized(event: PaymentAuthorizedEvent): Promise<void> {
    const result = await commitReservation(event.payload.orderId, {
      correlationId: event.correlationId,
      causationId: event.id,
      messageId: event.id,
      source: event.type,
    });

    if (result.status === "duplicate") {
      console.log(`${WORKER_NAME} duplicate PaymentAuthorized ${event.payload.orderId}`);
      return;
    }

    if (result.status === "noop") {
      console.log(`${WORKER_NAME} no active reservation for ${event.payload.orderId}`);
      return;
    }

    console.log(`${WORKER_NAME} committed stock for ${event.payload.orderId}`);
  }

  private async handleOrderCanceled(event: OrderCanceledEvent): Promise<void> {
    await this.releaseAndLog(event.payload.orderId, event.payload.reason ?? "order_canceled", event);
  }

  private async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.releaseAndLog(event.payload.orderId, event.payload.reason ?? "payment_failed", event);
  }

  private async releaseAndLog(
    orderId: string,
    reason: string,
    event: OrderCanceledEvent | PaymentFailedEvent
  ): Promise<void> {
    const result = await releaseReservation(orderId, reason, "release", {
      correlationId: event.correlationId,
      causationId: event.id,
      messageId: event.id,
      source: event.type,
    });

    if (result.status === "duplicate") {
      console.log(`${WORKER_NAME} duplicate release for ${orderId}`);
      return;
    }

    if (result.status === "noop") {
      console.log(`${WORKER_NAME} no active reservation to release for ${orderId}`);
      return;
    }

    console.log(`${WORKER_NAME} released reservation for ${orderId} (${reason})`);
  }
}
