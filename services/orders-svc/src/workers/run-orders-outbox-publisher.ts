import { runOrdersOutboxPublisherWorker } from "./orders-outbox-publisher.js";

runOrdersOutboxPublisherWorker().catch((error) => {
  console.error("[orders-outbox-worker] fatal error", error);
  process.exit(1);
});
