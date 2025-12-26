import { describe, beforeAll, afterAll, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import type { ServerType } from "@hono/node-server";
import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import { RabbitMqClient } from "@ecommerce/message-broker";
import type { EventEnvelope } from "@ecommerce/events";
import { randomUUID } from "node:crypto";
import { CatalogEventType, type ProductCreatedV1 } from "../../src/catalog/events";
import { catalogOutboxEvents } from "../../src/db/schema";
import {
  applyMigrations,
  randomQueueName,
  setupDockerTestDb,
  setupServer,
  waitFor,
} from "./test-utils";
type CatalogOutboxPublisherWorkerClass =
  typeof import("../../src/workers/catalog-outbox-publisher").CatalogOutboxPublisherWorker;

describe("Catalog create product flow", () => {
  const SERVER_PORT = 3201;
  const baseUrl = `http://127.0.0.1:${SERVER_PORT}`;

  let db: typeof import("../../src/db").default;
  let pool: Pool;
  let server: ServerType;
  let app: typeof import("../../src/app").default;
  let pgContainer: Awaited<ReturnType<typeof setupDockerTestDb>>["container"];
  let rabbitContainer: StartedRabbitMQContainer;
  let rabbitUrl: string;
  let CatalogOutboxPublisherWorker: CatalogOutboxPublisherWorkerClass;
  let worker: InstanceType<CatalogOutboxPublisherWorkerClass>;
  let workerPromise: Promise<void> | undefined;
  let subscriberClient: RabbitMqClient;
  type CatalogIntegrationEvent = EventEnvelope<ProductCreatedV1["payload"]>;
  const receivedEvents: CatalogIntegrationEvent[] = [];

  beforeAll(async () => {
    const docker = await setupDockerTestDb();
    pgContainer = docker.container;
    process.env.DATABASE_URL = docker.connectionString;

    vi.resetModules();
    const dbModule = await import("../../src/db");
    db = dbModule.default;
    pool = dbModule.pool;
    await applyMigrations(db);

    ({ CatalogOutboxPublisherWorker } = await import("../../src/workers/catalog-outbox-publisher"));
    ({ default: app } = await import("../../src/app"));
    server = await setupServer(app, SERVER_PORT);

    rabbitContainer = await new RabbitMQContainer("rabbitmq:3.13-management-alpine").start();
    rabbitUrl = rabbitContainer.getAmqpUrl();

    const publisherClient = await RabbitMqClient.connect({
      url: rabbitUrl,
      exchange: "catalog.events.flow",
      exchangeType: "topic",
      queue: randomQueueName("catalog.events.publisher"),
      prefetch: 1,
    });
    worker = new CatalogOutboxPublisherWorker(publisherClient, {
      batchSize: 25,
      pollIntervalMs: 100,
    });
    workerPromise = worker.start();

    subscriberClient = await RabbitMqClient.connect({
      url: rabbitUrl,
      exchange: "catalog.events.flow",
      exchangeType: "topic",
      queue: randomQueueName("catalog.events.subscriber"),
      prefetch: 1,
    });
    await subscriberClient.subscribe<ProductCreatedV1["payload"]>({
      queue: randomQueueName("catalog.events.subscriber.queue"),
      routingKey: "catalog.#",
      handler: async (event) => {
        receivedEvents.push(event);
      },
    });
  }, 180_000);

  afterAll(async () => {
    await subscriberClient?.close();
    if (worker) {
      await worker.stop();
      await workerPromise;
    }
    await server?.close();
    await pool?.end();
    await pgContainer?.stop();
    await rabbitContainer?.stop();
  });

  it(
    "creates a product and emits a single event even with duplicate idempotency keys",
    async () => {
      const requestBody = {
        title: "Test Tee",
        description: "A tee used in integration tests",
        brand: "Integration Brand",
        status: "draft",
        categories: [{ id: "tops", name: "Tops" }],
        media: [
          {
            url: "https://cdn.example.com/products/test-tee.png",
            sortOrder: 0,
            altText: "Test Tee",
          },
        ],
        variants: [
          {
            sku: "TEST-TEE-S",
            status: "active",
            attributes: { size: "S" },
            prices: [
              {
                currency: "usd",
                amountCents: 2500,
              },
            ],
          },
        ],
      };

      const idempotencyKey = randomUUID();
      const requestHeaders = {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-Request-Id": randomUUID(),
      };

      const firstResponse = await fetch(`${baseUrl}/api/catalog/products`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });
      expect(firstResponse.status).toBe(201);
      expect(firstResponse.headers.get("x-idempotent-replay")).toBe("false");
      const firstBody = (await firstResponse.json()) as { productId: string };
      expect(firstBody.productId).toBeDefined();

      try {
        await waitFor(
          () =>
            receivedEvents.some(
              (event) =>
                event.type === CatalogEventType.ProductCreatedV1 &&
                event.aggregate.id === firstBody.productId
            ),
          { timeoutMs: 30_000 }
        );
      } catch (error) {
        const outboxEntries = await db
          .select({
            id: catalogOutboxEvents.id,
            status: catalogOutboxEvents.status,
            error: catalogOutboxEvents.error,
            aggregateId: catalogOutboxEvents.aggregateId,
            publishedAt: catalogOutboxEvents.publishedAt,
          })
          .from(catalogOutboxEvents);
        console.error("[catalog-create-product-test] outbox entries", outboxEntries);
        console.error(
          "[catalog-create-product-test] received events",
          receivedEvents.map((event) => event.type)
        );
        throw error;
      }
      const matchingEvents = receivedEvents.filter(
        (event) =>
          event.type === CatalogEventType.ProductCreatedV1 &&
          event.aggregate.id === firstBody.productId
      );
      expect(matchingEvents).toHaveLength(1);

      const secondResponse = await fetch(`${baseUrl}/api/catalog/products`, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers.get("x-idempotent-replay")).toBe("true");
      const secondBody = (await secondResponse.json()) as { productId: string };
      expect(secondBody.productId).toBe(firstBody.productId);

      await new Promise((resolve) => setTimeout(resolve, 1_000));
      const eventsAfterReplay = receivedEvents.filter(
        (event) =>
          event.type === CatalogEventType.ProductCreatedV1 &&
          event.aggregate.id === firstBody.productId
      );
      expect(eventsAfterReplay).toHaveLength(1);

      const createdEvent = eventsAfterReplay[0];
      expect(createdEvent.payload.product.title).toBe(requestBody.title);
      expect(createdEvent.payload.variants).toHaveLength(1);
      expect(createdEvent.payload.prices).toHaveLength(1);
    },
    180_000
  );
});
