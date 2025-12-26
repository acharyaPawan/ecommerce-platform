import { runInventoryOutboxPublisherWorker } from "./inventory-outbox-publisher.js";

runInventoryOutboxPublisherWorker().catch((error) => {
  console.error("[inventory-outbox-runner] failed to start", error);
  process.exit(1);
});
