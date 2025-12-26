import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import type { ServerType } from "@hono/node-server";
import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { RabbitMqClient } from "@ecommerce/message-broker";
import type { EventEnvelope } from "@ecommerce/events";
import {
  OrderIntegrationEventType,
  type OrderPlacedEvent,
} from "../../src/inventory/order-events.js";
import {
  InventoryEventType,
  type AnyInventoryEvent,
} from "../../src/inventory/events.js";
import {
  inventoryBalance,
  inventoryReservations,
} from "../../src/db/schema.js";
import {
  applyMigrations,
  randomQueueName,
  setupDockerTestDb,
  setupServer,
  waitFor,
} from "./test-utils.js";

describe("inventory reservation flow", () => {
  const SERVER_PORT = 3301;
  const baseUrl = `http://127.0.0.1:${SERVER_PORT}`;

  let db: typeof import("../../src/db").default;
  let pool: Pool;
  let server: ServerType;
  let pgContainer: Awaited<ReturnType<typeof setupDockerTestDb>>["container"];
  let rabbitContainer: StartedRabbitMQContainer;
  let rabbitUrl: string;
  let InventoryOutboxPublisherWorker: typeof import("../../src/workers/inventory-outbox-publisher.js").InventoryOutboxPublisherWorker;
  let OrderEventsConsumer: typeof import("../../src/workers/order-events-consumer.js").OrderEventsConsumer;
  let inventoryService: typeof import("../../src/inventory/service.js");
  let outboxWorker: InstanceType<typeof InventoryOutboxPublisherWorker>;
  let outboxWorkerPromise: Promise<void> | undefined;
  let inventorySubscriber: RabbitMqClient;
  let orderPublisher: RabbitMqClient;
  let orderConsumer: InstanceType<typeof OrderEventsConsumer>;
  const inventoryEvents: EventEnvelope<Record<string, unknown>>[] = [];
  let inventoryExchange: string;
  let orderExchange: string;

  beforeAll(async () => {
    const docker = await setupDockerTestDb();
    pgContainer = docker.container;
    process.env.DATABASE_URL = docker.connectionString;

    vi.resetModules();
    const dbModule = await import("../../src/db/index.js");
    db = dbModule.default;
    pool = dbModule.pool;
    await applyMigrations(db);

    inventoryService = await import("../../src/inventory/service.js");
    ({ OrderEventsConsumer } = await import("../../src/workers/order-events-consumer.js"));
    ({ InventoryOutboxPublisherWorker } = await import("../../src/workers/inventory-outbox-publisher.js"));

    const appModule = await import("../../src/app.js");
    server = await setupServer(appModule.default, SERVER_PORT);

    rabbitContainer = await new RabbitMQContainer("rabbitmq:3.13-management-alpine").start();
    rabbitUrl = rabbitContainer.getAmqpUrl();
    inventoryExchange = `inventory.events.${randomUUID()}`;
    orderExchange = `orders.events.${randomUUID()}`;
    process.env.INVENTORY_EVENTS_EXCHANGE = inventoryExchange;
    process.env.ORDER_EVENTS_EXCHANGE = orderExchange;

    const outboxBroker = await RabbitMqClient.connect({
      url: rabbitUrl,
      exchange: inventoryExchange,
      exchangeType: "topic",
      queue: randomQueueName("inventory.outbox"),
      prefetch: 1,
    });
    outboxWorker = new InventoryOutboxPublisherWorker(outboxBroker, {
      batchSize: 25,
      pollIntervalMs: 100,
    });
    outboxWorkerPromise = outboxWorker.start();

    inventorySubscriber = await RabbitMqClient.connect({
      url: rabbitUrl,
      exchange: inventoryExchange,
      exchangeType: "topic",
      queue: randomQueueName("inventory.events.subscriber"),
      prefetch: 1,
    });
    await inventorySubscriber.subscribe({
      queue: randomQueueName("inventory.events.subscriber.queue"),
      routingKey: "inventory.#",
      handler: async (event) => {
        inventoryEvents.push(event);
      },
    });

    orderPublisher = await RabbitMqClient.connect({
      url: rabbitUrl,
      exchange: orderExchange,
      exchangeType: "topic",
      queue: randomQueueName("orders.publisher"),
      prefetch: 1,
    });

    const consumerQueue = randomQueueName("inventory.orders.consumer");
    const orderConsumerClient = await RabbitMqClient.connect({
      url: rabbitUrl,
      exchange: orderExchange,
      exchangeType: "topic",
      queue: consumerQueue,
      prefetch: 1,
    });
    orderConsumer = new OrderEventsConsumer(orderConsumerClient, consumerQueue);
    await orderConsumer.start();
  }, 180_000);

  afterAll(async () => {
    await orderConsumer?.stop();
    await orderPublisher?.close();
    await inventorySubscriber?.close();
    if (outboxWorker) {
      await outboxWorker.stop();
      await outboxWorkerPromise;
    }
    await server?.close();
    await pool?.end();
    await pgContainer?.stop();
    await rabbitContainer?.stop();
  });

  it(
    "reserves and commits inventory when order + payment events arrive",
    async () => {
      const sku = `SKU-${randomUUID()}`;
      const orderId = randomUUID();
      await inventoryService.adjustStock({ sku, delta: 10, reason: "initial" });

      await publishOrderPlaced(orderId, sku, 2);

      await waitForEvent(InventoryEventType.StockReservedV1, orderId);

      const summaryAfterReserve = await inventoryService.getInventorySummary(sku);
      expect(summaryAfterReserve).not.toBeNull();
      expect(summaryAfterReserve?.reserved).toBe(2);
      expect(summaryAfterReserve?.available).toBe(8);

      const apiResponse = await fetch(`${baseUrl}/api/inventory/${sku}`);
      expect(apiResponse.status).toBe(200);
      const apiPayload = (await apiResponse.json()) as {
        onHand: number;
        reserved: number;
        available: number;
      };
      expect(apiPayload.reserved).toBe(2);
      expect(apiPayload.available).toBe(8);

      await publishPaymentAuthorized(orderId);
      await waitForEvent(InventoryEventType.StockCommittedV1, orderId);

      const balance = await db.query.inventoryBalance.findFirst({
        where: eq(inventoryBalance.sku, sku),
      });
      expect(balance?.onHand).toBe(8);
      expect(balance?.reserved).toBe(0);

      const reservations = await db.query.inventoryReservations.findMany({
        where: eq(inventoryReservations.reservationId, orderId),
      });
      expect(reservations.every((row) => row.status === "COMMITTED")).toBe(true);
    },
    120_000
  );

  it(
    "releases reservations when cancellation arrives",
    async () => {
      const sku = `SKU-${randomUUID()}`;
      const orderId = randomUUID();
      await inventoryService.adjustStock({ sku, delta: 5, reason: "initial" });

      await publishOrderPlaced(orderId, sku, 3);
      await waitForEvent(InventoryEventType.StockReservedV1, orderId);

      await publishOrderCanceled(orderId, "customer_request");
      await waitForEvent(InventoryEventType.StockReservationReleasedV1, orderId);

      const balance = await db.query.inventoryBalance.findFirst({
        where: eq(inventoryBalance.sku, sku),
      });
      expect(balance?.reserved).toBe(0);
      expect(balance?.onHand).toBe(5);

      const reservations = await db.query.inventoryReservations.findMany({
        where: eq(inventoryReservations.reservationId, orderId),
      });
      expect(reservations.every((row) => row.status === "RELEASED")).toBe(true);
    },
    120_000
  );

  async function publishOrderPlaced(orderId: string, sku: string, qty: number): Promise<void> {
    const envelope: EventEnvelope<OrderPlacedEvent["payload"]> = {
      id: randomUUID(),
      type: OrderIntegrationEventType.OrderPlacedV1,
      occurredAt: new Date().toISOString(),
      aggregate: {
        id: orderId,
        type: "order",
        version: 1,
      },
      payload: {
        orderId,
        items: [{ sku, qty }],
        ttlSeconds: 60,
      },
    };
    await orderPublisher.publish(envelope, { routingKey: envelope.type });
  }

  async function publishPaymentAuthorized(orderId: string): Promise<void> {
    const envelope: EventEnvelope<{ orderId: string }> = {
      id: randomUUID(),
      type: OrderIntegrationEventType.PaymentAuthorizedV1,
      occurredAt: new Date().toISOString(),
      aggregate: {
        id: orderId,
        type: "order",
        version: 1,
      },
      payload: { orderId },
    };
    await orderPublisher.publish(envelope, { routingKey: envelope.type });
  }

  async function publishOrderCanceled(orderId: string, reason: string): Promise<void> {
    const envelope: EventEnvelope<{ orderId: string; reason: string }> = {
      id: randomUUID(),
      type: OrderIntegrationEventType.OrderCanceledV1,
      occurredAt: new Date().toISOString(),
      aggregate: {
        id: orderId,
        type: "order",
        version: 1,
      },
      payload: { orderId, reason },
    };
    await orderPublisher.publish(envelope, { routingKey: envelope.type });
  }

  async function waitForEvent(type: InventoryEventType, orderId: string): Promise<void> {
    await waitFor(
      () =>
        inventoryEvents.some(
          (event) =>
            (event as AnyInventoryEvent).type === type &&
            (event as AnyInventoryEvent).payload.orderId === orderId
        ),
      { timeoutMs: 30_000 }
    );
  }
});
