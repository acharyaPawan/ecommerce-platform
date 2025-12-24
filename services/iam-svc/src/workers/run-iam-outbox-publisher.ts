import { runIamOutboxPublisherWorker } from "./iam-outbox-publisher.js";

runIamOutboxPublisherWorker().catch((error) => {
  console.error("[iam-outbox-worker] fatal error", error);
  process.exit(1);
});
