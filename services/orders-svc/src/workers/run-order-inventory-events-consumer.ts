import "dotenv/config";
import { RabbitMqClient } from "@ecommerce/message-broker";
import logger from "../logger.js";
import { OrderInventoryEventsConsumer } from "./order-inventory-events-consumer.js";

const WORKER_NAME = "[orders-inventory-consumer-runner]";

function resolveNumberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function runOrderInventoryEventsConsumer(): Promise<void> {
  const queue = process.env.ORDERS_INVENTORY_EVENTS_QUEUE ?? "orders.inventory-events";

  const broker = await RabbitMqClient.connect({
    url: process.env.RABBITMQ_URL,
    exchange: process.env.INVENTORY_EVENTS_EXCHANGE ?? "inventory.events",
    queue,
    prefetch: resolveNumberFromEnv("ORDERS_INVENTORY_EVENTS_PREFETCH", 10),
  });

  const consumer = new OrderInventoryEventsConsumer(broker, queue);

  const shutdown = async () => {
    logger.info(`${WORKER_NAME} shutting down`);
    await consumer.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await consumer.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOrderInventoryEventsConsumer().catch((error) => {
    logger.error({ err: error }, `${WORKER_NAME} failed to start`);
    process.exit(1);
  });
}
