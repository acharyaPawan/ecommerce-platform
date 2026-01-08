import { runPaymentsOutboxPublisherWorker } from "./payments-outbox-publisher.js";

runPaymentsOutboxPublisherWorker().catch((error) => {
  console.error("[payments-outbox-worker] fatal error", error);
  process.exit(1);
});
