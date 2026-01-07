import { expireReservations } from "../inventory/service.js";
import logger from "../logger.js";

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_INTERVAL_MS = 5_000;
const WORKER_NAME = "[inventory-reservation-expirer]";

export interface ReservationExpirerOptions {
  batchSize: number;
  intervalMs: number;
}

export class ReservationExpirerWorker {
  private stopped = false;
  private delayTimer: NodeJS.Timeout | null = null;
  private delayResolve: (() => void) | null = null;

  constructor(private readonly options: ReservationExpirerOptions) {}

  async start(): Promise<void> {
    logger.info(
      `${WORKER_NAME} starting (batch=${this.options.batchSize}, interval=${this.options.intervalMs}ms)`
    );

    while (!this.stopped) {
      try {
        const released = await expireReservations(this.options.batchSize);
        if (released === 0) {
          await this.waitForNextRun();
        }
      } catch (error) {
        logger.error({ err: error }, `${WORKER_NAME} failed to release reservations`);
        await this.waitForNextRun();
      }
    }

    logger.info(`${WORKER_NAME} stopped`);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    this.delayResolve?.();
    this.delayResolve = null;
  }

  private async waitForNextRun(): Promise<void> {
    if (this.options.intervalMs <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.delayResolve = resolve;
      this.delayTimer = setTimeout(() => {
        this.delayTimer = null;
        this.delayResolve = null;
        resolve();
      }, this.options.intervalMs);
    });
  }
}

export function resolveExpirerOptionsFromEnv(): ReservationExpirerOptions {
  return {
    batchSize: resolveNumberFromEnv("INVENTORY_EXPIRER_BATCH_SIZE", DEFAULT_BATCH_SIZE),
    intervalMs: resolveNumberFromEnv("INVENTORY_EXPIRER_INTERVAL_MS", DEFAULT_INTERVAL_MS),
  };
}

function resolveNumberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
