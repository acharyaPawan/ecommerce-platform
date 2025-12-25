import { runCatalogOutboxPublisherWorker } from "./catalog-outbox-publisher.js";

runCatalogOutboxPublisherWorker().catch((error) => {
  console.error("[catalog-outbox-worker] fatal error", error);
  process.exit(1);
});
