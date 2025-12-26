import "dotenv/config";
import { ReservationExpirerWorker, resolveExpirerOptionsFromEnv } from "./reservation-expirer.js";

const WORKER_NAME = "[inventory-reservation-expirer-runner]";

export async function runReservationExpirer(): Promise<void> {
  const worker = new ReservationExpirerWorker(resolveExpirerOptionsFromEnv());

  const shutdown = async () => {
    console.log(`${WORKER_NAME} shutting down`);
    await worker.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await worker.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReservationExpirer().catch((error) => {
    console.error(`${WORKER_NAME} failed to start`, error);
    process.exit(1);
  });
}
