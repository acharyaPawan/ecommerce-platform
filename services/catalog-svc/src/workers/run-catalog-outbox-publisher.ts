import { runCatalogOutboxPublisherWorker } from "./catalog-outbox-publisher.js";
import logger from "../logger.js";

runCatalogOutboxPublisherWorker().catch((error) => {
  logger.error({ err: error }, "[catalog-outbox-worker] fatal error");
  process.exit(1);
});
