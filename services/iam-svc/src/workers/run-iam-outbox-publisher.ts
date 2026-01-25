import { runIamOutboxPublisherWorker } from "./iam-outbox-publisher.js";
import { logger } from "../logger.js";

runIamOutboxPublisherWorker().catch((error) => {
  logger.error({ err: error }, "[iam-outbox-worker] fatal error");
  process.exit(1);
});
