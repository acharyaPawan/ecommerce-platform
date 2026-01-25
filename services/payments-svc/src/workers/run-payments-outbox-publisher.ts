import { runPaymentsOutboxPublisherWorker } from "./payments-outbox-publisher.js";
import logger from "../logger.js";

runPaymentsOutboxPublisherWorker().catch((error) => {
  logger.error({ err: error }, "[payments-outbox-worker] fatal error");
  process.exit(1);
});
