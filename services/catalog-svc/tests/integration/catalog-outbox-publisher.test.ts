import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import type { Pool } from "pg";
import { describe, beforeAll, afterAll, it, expect, vi } from "vitest";
import { RabbitMqClient } from "@ecommerce/message-broker";
import type { EventEnvelope } from "@ecommerce/events";
import { randomUUID } from "node:crypto";
import { catalogOutboxEvents } from "../../src/db/schema";
import { CatalogEventType, makeCatalogEnvelope, type ProductCreatedV1 } from "../../src/catalog/events";
import { mapCatalogEventToOutboxRecord } from "../../src/catalog/outbox";
import {
  applyMigrations,
  randomQueueName,
  setupDockerTestDb,
  waitFor,
} from "./test-utils";

type CatalogOutboxPublisherWorkerClass =
  typeof import("../../src/workers/catalog-outbox-publisher").CatalogOutboxPublisherWorker;

describe("CatalogOutboxPublisherWorker", () => {
  let db: typeof import("../../src/db").default;
  let pool: Pool;
  let pgContainer: Awaited<ReturnType<typeof setupDockerTestDb>>["container"];
  let rabbitContainer: StartedRabbitMQContainer;
  let rabbitUrl: string;
  let CatalogOutboxPublisherWorker: CatalogOutboxPublisherWorkerClass;

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

    rabbitContainer = await new RabbitMQContainer("rabbitmq:3.13-management-alpine").start();
    rabbitUrl = rabbitContainer.getAmqpUrl();
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await pgContainer?.stop();
    await rabbitContainer?.stop();
  });

  it(
    "publishes pending outbox events and marks them as published",
    async () => {
      const publisherClient = await RabbitMqClient.connect({
        url: rabbitUrl,
        exchange: "catalog.events.test",
        exchangeType: "topic",
        queue: randomQueueName("catalog.events.publisher"),
        prefetch: 1,
      });
      const consumerClient = await RabbitMqClient.connect({
        url: rabbitUrl,
        exchange: "catalog.events.test",
        exchangeType: "topic",
        queue: randomQueueName("catalog.events.consumer"),
        prefetch: 1,
      });

      type CatalogIntegrationEvent = EventEnvelope<ProductCreatedV1["payload"]>;
      const received: CatalogIntegrationEvent[] = [];
      await consumerClient.subscribe<ProductCreatedV1["payload"]>({
        queue: randomQueueName("catalog.events.consumer.queue"),
        routingKey: "catalog.#",
        handler: async (event) => {
          received.push(event);
        },
      });

      const aggregateId = randomUUID();
      const now = new Date();
      const envelope = makeCatalogEnvelope({
        type: CatalogEventType.ProductCreatedV1,
        aggregateId,
        payload: {
          product: {
            id: aggregateId,
            title: "Worker Product",
            description: null,
            brand: null,
            status: "draft",
            createdAt: now.toISOString(),
          },
          variants: [],
          prices: [],
          categories: [],
          media: [],
        },
      });

      await db.insert(catalogOutboxEvents).values({
        ...mapCatalogEventToOutboxRecord(envelope),
        createdAt: now,
        updatedAt: now,
      });

      const worker = new CatalogOutboxPublisherWorker(publisherClient, {
        batchSize: 5,
        pollIntervalMs: 50,
      });
      const workerPromise = worker.start();

      await waitFor(() => received.length === 1, { timeoutMs: 30_000 });

      const stored = await db.query.catalogOutboxEvents.findFirst({
        where: (events, { eq }) => eq(events.id, envelope.id),
      });
      expect(stored?.status).toBe("published");
      expect(stored?.publishedAt).toBeInstanceOf(Date);
      expect(stored?.error).toBeNull();

      await worker.stop();
      await workerPromise;
      await consumerClient.close();
    },
    60_000
  );
});
