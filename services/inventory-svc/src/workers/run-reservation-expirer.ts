import "dotenv/config";
import { ReservationExpirerWorker, resolveExpirerOptionsFromEnv } from "./reservation-expirer.js";
import logger from "../logger.js";

const WORKER_NAME = "[inventory-reservation-expirer-runner]";

export async function runReservationExpirer(): Promise<void> {
  const worker = new ReservationExpirerWorker(resolveExpirerOptionsFromEnv());

  const shutdown = async () => {
    logger.info(`${WORKER_NAME} shutting down`);
    await worker.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await worker.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReservationExpirer().catch((error) => {
    logger.error({ err: error }, `${WORKER_NAME} failed to start`);
    process.exit(1);
  });
}
