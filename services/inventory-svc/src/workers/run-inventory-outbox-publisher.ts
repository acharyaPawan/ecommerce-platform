import { runInventoryOutboxPublisherWorker } from "./inventory-outbox-publisher.js";
import logger from "../logger.js";

runInventoryOutboxPublisherWorker().catch((error) => {
  logger.error({ err: error }, "[inventory-outbox-runner] failed to start");
  process.exit(1);
});
