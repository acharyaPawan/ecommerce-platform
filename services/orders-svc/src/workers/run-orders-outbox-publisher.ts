import { runOrdersOutboxPublisherWorker } from "./orders-outbox-publisher.js";
import logger from "../logger.js";

runOrdersOutboxPublisherWorker().catch((error) => {
  logger.error({ err: error }, "[orders-outbox-worker] fatal error");
  process.exit(1);
});
