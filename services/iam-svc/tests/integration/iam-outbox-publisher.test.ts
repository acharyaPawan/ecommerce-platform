import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";
import type { Pool } from "pg";
import { describe, beforeAll, afterAll, it, expect, vi } from "vitest";
import { RabbitMqClient } from "@ecommerce/message-broker";
import type { EventEnvelope } from "@ecommerce/events";
import { randomUUID } from "node:crypto";
import { iamOutboxEvents } from "../../src/db/schema";
import { IamEventType, makeIamEnvelope } from "../../src/contracts/iam-events";
import { mapToOutboxEvent } from "../../src/auth";
import {
  applyMigrations,
  randomQueueName,
  setupDockerTestDb,
  waitFor,
} from "./test-utils";

type IamOutboxPublisherWorkerClass = typeof import("../../src/workers/iam-outbox-publisher").IamOutboxPublisherWorker;

describe("IamOutboxPublisherWorker", () => {
  let db: typeof import("../../src/db").default;
  let pool: Pool;
  let pgContainer: Awaited<ReturnType<typeof setupDockerTestDb>>["container"];
  let rabbitContainer: StartedRabbitMQContainer;
  let rabbitUrl: string;
  let IamOutboxPublisherWorker: IamOutboxPublisherWorkerClass;

  beforeAll(async () => {
    const docker = await setupDockerTestDb();
    pgContainer = docker.container;
    process.env.DATABASE_URL = docker.connectionString;

    vi.resetModules();
    const dbModule = await import("../../src/db");
    db = dbModule.default;
    pool = dbModule.pool;
    await applyMigrations(db);
    ({ IamOutboxPublisherWorker } = await import("../../src/workers/iam-outbox-publisher"));

    rabbitContainer = await new RabbitMQContainer("rabbitmq:3.13-management-alpine").start();
    rabbitUrl = rabbitContainer.getAmqpUrl();
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await pgContainer?.stop();
    await rabbitContainer?.stop();
  });

  it(
    "publishes pending events and marks them as published",
    async () => {
      console.log('random queue is', randomQueueName("iam.events.consumer"));
      const publisherClient = await RabbitMqClient.connect({
        url: rabbitUrl,
        exchange: "iam.events.test",
        exchangeType: "topic",
        queue: randomQueueName("iam.events.publisher"),
        prefetch: 1,
      });
      console.log('random queue is', randomQueueName("iam.events.consumer"));
      const consumerClient = await RabbitMqClient.connect({
        url: rabbitUrl,
        exchange: "iam.events.test",
        exchangeType: "topic",
        queue: randomQueueName("iam.events.consumer"),
        prefetch: 1,
      });

      const received: EventEnvelope<Record<string, unknown>>[] = [];
      await consumerClient.subscribe({
        queue: randomQueueName("iam.events.consumer.queue"),
        routingKey: "iam.#",
        handler: async (event) => {
          received.push(event);
        },
      });

      const aggregateId = randomUUID();
      const envelope = makeIamEnvelope({
        type: IamEventType.UserRegisteredV1,
        aggregateId,
        payload: {
          userId: aggregateId,
          email: "worker@test.com",
          name: "Worker Test",
          emailVerified: false,
        },
      });

      console.log('test here db url is', process.env.DATABASE_URL)
      try {
        const inserted = await db.insert(iamOutboxEvents).values([mapToOutboxEvent(envelope)]).returning();
        console.log('iam_outbox_publisher_worker_test Inserted event to db', JSON.stringify(inserted, null, 3));
      } catch (e) {
        console.error('iam_outbox_publisher_test error while pushing entry')
        throw e
      }


      process.env.RABBITMQ_URL = rabbitUrl;
      // process.env.DATABASE_URL = 
      const worker = new IamOutboxPublisherWorker(publisherClient, {
        batchSize: 5,
        pollIntervalMs: 50,
      });
      const workerPromise = worker.start();

      await waitFor(() => received.length === 1, { timeoutMs: 30_000 });

      const stored = await db.query.iamOutboxEvents.findFirst({
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
