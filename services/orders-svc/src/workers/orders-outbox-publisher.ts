import "dotenv/config";
import type { EventEnvelope } from "@ecommerce/events";
import { RabbitMqClient } from "@ecommerce/message-broker";
import { and, asc, eq } from "drizzle-orm";
import db from "../db/index.js";
import { ordersOutboxEvents } from "../db/schema.js";

type OrdersOutboxRecord = typeof ordersOutboxEvents.$inferSelect;

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const WORKER_NAME = "[orders-outbox-worker]";

export interface WorkerOptions {
  batchSize: number;
  pollIntervalMs: number;
}

export class OrdersOutboxPublisherWorker {
  private stopped = false;
  private delayTimer: NodeJS.Timeout | null = null;
  private delayResolve: (() => void) | null = null;

  constructor(
    private readonly broker: RabbitMqClient,
    private readonly options: WorkerOptions
  ) {}

  async start(): Promise<void> {
    console.log(
      `${WORKER_NAME} starting (batchSize=${this.options.batchSize}, pollInterval=${this.options.pollIntervalMs}ms)`
    );

    while (!this.stopped) {
      const published = await this.publishNextBatch();
      if (this.stopped) {
        break;
      }
      if (published === 0) {
        await this.waitForNextPoll();
      }
    }

    console.log(`${WORKER_NAME} stopped`);
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
      .from(ordersOutboxEvents)
      .where(eq(ordersOutboxEvents.status, "pending"))
      .orderBy(asc(ordersOutboxEvents.occurredAt))
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
        console.error(`${WORKER_NAME} failed to publish event ${record.id}`, error);
        await this.markFailed(record.id, error);
      }
    }

    return publishedCount;
  }

  private async claim(id: string): Promise<boolean> {
    const result = await db
      .update(ordersOutboxEvents)
      .set({
        status: "processing",
        updatedAt: new Date(),
        error: null,
      })
      .where(and(eq(ordersOutboxEvents.id, id), eq(ordersOutboxEvents.status, "pending")))
      .returning({ id: ordersOutboxEvents.id });

    return result.length > 0;
  }

  private async markPublished(id: string): Promise<void> {
    await db
      .update(ordersOutboxEvents)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(ordersOutboxEvents.id, id));
  }

  private async markFailed(id: string, error: unknown): Promise<void> {
    await db
      .update(ordersOutboxEvents)
      .set({
        status: "failed",
        updatedAt: new Date(),
        error: serializeError(error),
      })
      .where(eq(ordersOutboxEvents.id, id));
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
}

function mapToIntegrationEvent(record: OrdersOutboxRecord): EventEnvelope<Record<string, unknown>> {
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

export async function runOrdersOutboxPublisherWorker(): Promise<void> {
  const broker = await RabbitMqClient.connect({
    url: process.env.RABBITMQ_URL,
    exchange: process.env.ORDER_EVENTS_EXCHANGE ?? "orders.events",
    exchangeType: "topic",
    queue: process.env.ORDER_EVENTS_QUEUE ?? "orders.events.publisher",
    prefetch: 0,
  });

  const worker = new OrdersOutboxPublisherWorker(broker, {
    batchSize: resolveNumberFromEnv("ORDERS_OUTBOX_BATCH_SIZE", DEFAULT_BATCH_SIZE),
    pollIntervalMs: resolveNumberFromEnv("ORDERS_OUTBOX_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS),
  });

  const shutdown = async () => {
    console.log(`${WORKER_NAME} shutting down`);
    await worker.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await worker.start();
}
