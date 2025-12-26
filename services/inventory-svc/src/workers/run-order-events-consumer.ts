import "dotenv/config";
import { RabbitMqClient } from "@ecommerce/message-broker";
import { OrderEventsConsumer } from "./order-events-consumer.js";

const WORKER_NAME = "[inventory-order-consumer-runner]";

function resolveNumberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function runOrderEventsConsumer(): Promise<void> {
  const queue = process.env.INVENTORY_ORDER_EVENTS_QUEUE ?? "inventory.order-events";

  const broker = await RabbitMqClient.connect({
    url: process.env.RABBITMQ_URL,
    exchange: process.env.ORDER_EVENTS_EXCHANGE,
    queue,
    prefetch: resolveNumberFromEnv("ORDER_EVENTS_PREFETCH", 10),
  });
  const consumer = new OrderEventsConsumer(broker, queue);

  const shutdown = async () => {
    console.log(`${WORKER_NAME} shutting down`);
    await consumer.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await consumer.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOrderEventsConsumer().catch((error) => {
    console.error(`${WORKER_NAME} failed to start`, error);
    process.exit(1);
  });
}
