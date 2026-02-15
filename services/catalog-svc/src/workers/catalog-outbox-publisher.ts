import "dotenv/config";
import { RabbitMqClient } from "@ecommerce/message-broker";
import type { EventEnvelope } from "@ecommerce/events";
import { and, asc, eq } from "drizzle-orm";
import db from "../db/index.js";
import { catalogOutboxEvents } from "../db/schema.js";
import logger from "../logger.js";

type CatalogOutboxRecord = typeof catalogOutboxEvents.$inferSelect;

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_POLL_INTERVAL_MS = 40_000;
const WORKER_NAME = "[catalog-outbox-worker]";

export interface WorkerOptions {
  batchSize: number;
  pollIntervalMs: number;
}

export class CatalogOutboxPublisherWorker {
  private stopped = false;
  private delayTimer: NodeJS.Timeout | null = null;
  private delayResolve: (() => void) | null = null;

  constructor(
    private readonly broker: RabbitMqClient,
    private readonly options: WorkerOptions
  ) {}

  async start(): Promise<void> {
    logger.info(
      {
        batchSize: this.options.batchSize,
        pollIntervalMs: this.options.pollIntervalMs,
      },
      `${WORKER_NAME} starting`
    );

    while (!this.stopped) {
      let published = 0;
      try {
        published = await this.publishNextBatch();
      } catch (error) {
        logger.error({ err: error }, `${WORKER_NAME} batch_failed_retrying`);
        await this.waitForRetryAfterError();
        continue;
      }
      if (this.stopped) {
        break;
      }
      if (published === 0) {
        await this.waitForNextPoll();
      }
    }

    logger.info(`${WORKER_NAME} stopped`);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    this.delayResolve?.();
    this.delayResolve = null;
    await this.broker.close();
  }

  private async publishNextBatch(): Promise<number> {
    const pendingEvents = await db
      .select()
      .from(catalogOutboxEvents)
      .where(eq(catalogOutboxEvents.status, "pending"))
      .orderBy(asc(catalogOutboxEvents.occurredAt))
      .limit(this.options.batchSize);

    if (pendingEvents.length === 0) {
      return 0;
    }

    let publishedCount = 0;
    for (const record of pendingEvents) {
      const claimed = await this.claim(record.id);
      if (!claimed) {
        continue;
      }

      try {
        const event = mapToIntegrationEvent(record);
        await this.broker.publish(event, {
          routingKey: record.type,
        });
        await this.markPublished(record.id);
        publishedCount += 1;
      } catch (error) {
        logger.error({ err: error, eventId: record.id }, `${WORKER_NAME} publish_failed`);
        await this.markFailed(record.id, error);
      }
    }

    return publishedCount;
  }

  private async claim(id: string): Promise<boolean> {
    const result = await db
      .update(catalogOutboxEvents)
      .set({
        status: "processing",
        updatedAt: new Date(),
        error: null,
      })
      .where(and(eq(catalogOutboxEvents.id, id), eq(catalogOutboxEvents.status, "pending")))
      .returning({ id: catalogOutboxEvents.id });

    return result.length > 0;
  }

  private async markPublished(id: string): Promise<void> {
    await db
      .update(catalogOutboxEvents)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(catalogOutboxEvents.id, id));
  }

  private async markFailed(id: string, error: unknown): Promise<void> {
    await db
      .update(catalogOutboxEvents)
      .set({
        status: "failed",
        updatedAt: new Date(),
        error: serializeError(error),
      })
      .where(eq(catalogOutboxEvents.id, id));
  }

  private async waitForNextPoll(): Promise<void> {
    if (this.options.pollIntervalMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.delayResolve = resolve;
      this.delayTimer = setTimeout(() => {
        this.delayResolve = null;
        this.delayTimer = null;
        resolve();
      }, this.options.pollIntervalMs);
    });
  }

  private async waitForRetryAfterError(): Promise<void> {
    const retryDelayMs = Math.min(Math.max(this.options.pollIntervalMs, 5_000), 15_000);
    await new Promise<void>((resolve) => {
      this.delayResolve = resolve;
      this.delayTimer = setTimeout(() => {
        this.delayResolve = null;
        this.delayTimer = null;
        resolve();
      }, retryDelayMs);
    });
  }
}

function mapToIntegrationEvent(record: CatalogOutboxRecord): EventEnvelope<Record<string, unknown>> {
  return {
    id: record.id,
    type: record.type,
    occurredAt:
      record.occurredAt instanceof Date
        ? record.occurredAt.toISOString()
        : new Date(record.occurredAt).toISOString(),
    aggregate: {
      type: record.aggregateType,
      id: record.aggregateId,
      version: 1,
    },
    correlationId: record.correlationId ?? undefined,
    causationId: record.causationId ?? undefined,
    payload: record.payload as Record<string, unknown>,
  };
}

function serializeError(error: unknown): string {
  if (!error) {
    return "Unknown error";
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return typeof error === "string" ? error : JSON.stringify(error);
}

function resolveNumberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function runCatalogOutboxPublisherWorker(): Promise<void> {
  const broker = await RabbitMqClient.connect({
    url: process.env.RABBITMQ_URL,
    exchange: process.env.CATALOG_EVENTS_EXCHANGE ?? "catalog.events",
    exchangeType: "topic",
    queue: process.env.CATALOG_EVENTS_QUEUE ?? "catalog.events.publisher",
    prefetch: 0,
  });

  const worker = new CatalogOutboxPublisherWorker(broker, {
    batchSize: resolveNumberFromEnv("CATALOG_OUTBOX_BATCH_SIZE", DEFAULT_BATCH_SIZE),
    pollIntervalMs: resolveNumberFromEnv("CATALOG_OUTBOX_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS),
  });

  const shutdown = async () => {
    logger.info(`${WORKER_NAME} shutting down`);
    await worker.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await worker.start();
}
