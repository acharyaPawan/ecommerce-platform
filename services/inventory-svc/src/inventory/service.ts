import { sql, and, eq, inArray, lt } from "drizzle-orm";
import db from "../db/index.js";
import {
  inventoryBalance,
  inventoryOutboxEvents,
  inventoryProcessedMessages,
  inventoryReservations,
} from "../db/schema.js";
import {
  InventoryEventType,
  makeInventoryEnvelope,
  type ReservationItemPayload,
} from "./events.js";
import { mapInventoryEventToOutboxRecord } from "./outbox.js";

const DEFAULT_RESERVATION_TTL_SECONDS = 15 * 60;

const RESERVATION_STATUS = {
  ACTIVE: "ACTIVE",
  RELEASED: "RELEASED",
  COMMITTED: "COMMITTED",
  EXPIRED: "EXPIRED",
} as const;

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

type DomainOptions = {
  correlationId?: string;
  causationId?: string;
  messageId?: string;
  source?: string;
};

export type InventorySummary = {
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  updatedAt: Date;
};

type AdjustmentInput = {
  sku: string;
  delta: number;
  reason: string;
  referenceId?: string;
};

type AdjustmentResult =
  | {
      status: "applied";
      summary: InventorySummary;
    }
  | { status: "duplicate" };

type ReservationItem = {
  sku: string;
  qty: number;
};

export type ReservableItems = ReservationItem[];

export type ReserveFailureReason = "INVALID_ITEMS" | "INSUFFICIENT_STOCK";

type ReserveStockInput = {
  orderId: string;
  items: ReservableItems;
  ttlSeconds?: number;
};

type ReserveStockResult =
  | { status: "reserved"; items: ReservationItemPayload[]; expiresAt: Date | null }
  | {
      status: "failed";
      reason: ReserveFailureReason;
      insufficientItems?: Array<{ sku: string; qty: number; available: number }>;
    }
  | { status: "duplicate" };

type CommitResult =
  | { status: "committed"; items: ReservationItemPayload[] }
  | { status: "noop" }
  | { status: "duplicate" };

type ReleaseMode = "release" | "expire";

type ReleaseResult =
  | { status: "released" | "expired"; items: ReservationItemPayload[] }
  | { status: "noop" }
  | { status: "duplicate" };

export async function getInventorySummary(sku: string): Promise<InventorySummary | null> {
  const record = await db.query.inventoryBalance.findFirst({
    where: eq(inventoryBalance.sku, sku),
  });

  if (!record) {
    return null;
  }

  const available = record.onHand - record.reserved;

  return {
    sku: record.sku,
    onHand: record.onHand,
    reserved: record.reserved,
    available,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(record.updatedAt),
  };
}

export async function adjustStock(input: AdjustmentInput, options: DomainOptions = {}): Promise<AdjustmentResult> {
  const normalizedSku = input.sku.trim();
  if (!normalizedSku) {
    throw new Error("SKU is required");
  }
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    if (options.messageId) {
      const claimed = await claimMessage(tx, options.messageId, options.source ?? "inventory.adjust", now);
      if (!claimed) {
        return { status: "duplicate" } as AdjustmentResult;
      }
    }

    const existing = await tx.query.inventoryBalance.findFirst({
      where: eq(inventoryBalance.sku, normalizedSku),
      columns: {
        sku: true,
        onHand: true,
        reserved: true,
        updatedAt: true,
      },
    });

    const currentOnHand = existing?.onHand ?? 0;
    const currentReserved = existing?.reserved ?? 0;
    const nextOnHand = currentOnHand + input.delta;

    if (nextOnHand < currentReserved || nextOnHand < 0) {
      throw new Error(`Adjustment would lead to negative on-hand for SKU ${normalizedSku}`);
    }

    if (existing) {
      await tx
        .update(inventoryBalance)
        .set({
          onHand: nextOnHand,
          updatedAt: now,
        })
        .where(eq(inventoryBalance.sku, normalizedSku));
    } else {
      await tx.insert(inventoryBalance).values({
        sku: normalizedSku,
        onHand: nextOnHand,
        reserved: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const event = makeInventoryEnvelope({
      type: InventoryEventType.StockAdjustmentAppliedV1,
      aggregateId: normalizedSku,
      aggregateType: "sku",
      payload: {
        sku: normalizedSku,
        delta: input.delta,
        onHand: nextOnHand,
        reserved: currentReserved,
        available: nextOnHand - currentReserved,
        reason: input.reason,
        referenceId: input.referenceId,
      },
      correlationId: options.correlationId,
      causationId: options.causationId,
    });

    await tx.insert(inventoryOutboxEvents).values({
      ...mapInventoryEventToOutboxRecord(event),
      createdAt: now,
      updatedAt: now,
    });

    return {
      status: "applied",
      summary: {
        sku: normalizedSku,
        onHand: nextOnHand,
        reserved: currentReserved,
        available: nextOnHand - currentReserved,
        updatedAt: now,
      },
    } satisfies AdjustmentResult;
  });

  return result;
}

export async function reserveStock(
  input: ReserveStockInput,
  options: DomainOptions = {}
): Promise<ReserveStockResult> {
  const normalizedItems = normalizeItems(input.items);
  const ttlSeconds = resolveTtl(input.ttlSeconds);

  return db.transaction(async (tx) => {
    const now = new Date();

    if (options.messageId) {
      const claimed = await claimMessage(
        tx,
        options.messageId,
        options.source ?? "inventory.reserve",
        now
      );
      if (!claimed) {
        return { status: "duplicate" } as ReserveStockResult;
      }
    }

    if (normalizedItems.length === 0) {
      const invalidEvent = makeInventoryEnvelope({
        type: InventoryEventType.StockReservationFailedV1,
        aggregateId: input.orderId,
        aggregateType: "reservation",
        payload: {
          orderId: input.orderId,
          reason: "INVALID_ITEMS" as const,
        },
        correlationId: options.correlationId,
        causationId: options.causationId,
      });

      await tx.insert(inventoryOutboxEvents).values({
        ...mapInventoryEventToOutboxRecord(invalidEvent),
        createdAt: now,
        updatedAt: now,
      });

      return { status: "failed", reason: "INVALID_ITEMS" };
    }

    const expiresAt = ttlSeconds > 0 ? new Date(now.getTime() + ttlSeconds * 1000) : null;
    const balances = await loadBalances(tx, normalizedItems.map((item) => item.sku));

    const insufficient = normalizedItems
      .map((item) => {
        const balance = balances.get(item.sku);
        const onHand = balance?.onHand ?? 0;
        const reserved = balance?.reserved ?? 0;
        const available = onHand - reserved;
        return {
          sku: item.sku,
          qty: item.qty,
          available,
        };
      })
      .filter((item) => item.available < item.qty);

    if (insufficient.length > 0) {
      const failureEvent = makeInventoryEnvelope({
        type: InventoryEventType.StockReservationFailedV1,
        aggregateId: input.orderId,
        aggregateType: "reservation",
        payload: {
          orderId: input.orderId,
          reason: "INSUFFICIENT_STOCK" as const,
          insufficientItems: insufficient,
        },
        correlationId: options.correlationId,
        causationId: options.causationId,
      });

      await tx.insert(inventoryOutboxEvents).values({
        ...mapInventoryEventToOutboxRecord(failureEvent),
        createdAt: now,
        updatedAt: now,
      });

      return {
        status: "failed",
        reason: "INSUFFICIENT_STOCK",
        insufficientItems: insufficient,
      };
    }

    const reservationRows = normalizedItems.map((item) => ({
      reservationId: input.orderId,
      sku: item.sku,
      qty: item.qty,
      status: RESERVATION_STATUS.ACTIVE,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    }));

    if (reservationRows.length > 0) {
      await tx
        .insert(inventoryReservations)
        .values(reservationRows)
        .onConflictDoNothing();
    }

    for (const item of normalizedItems) {
      await tx
        .update(inventoryBalance)
        .set({
          reserved: sql`${inventoryBalance.reserved} + ${item.qty}`,
          updatedAt: now,
        })
        .where(eq(inventoryBalance.sku, item.sku));
    }

    const reservedEvent = makeInventoryEnvelope({
      type: InventoryEventType.StockReservedV1,
      aggregateId: input.orderId,
      aggregateType: "reservation",
      payload: {
        orderId: input.orderId,
        items: normalizedItems,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      correlationId: options.correlationId,
      causationId: options.causationId,
    });

    await tx.insert(inventoryOutboxEvents).values({
      ...mapInventoryEventToOutboxRecord(reservedEvent),
      createdAt: now,
      updatedAt: now,
    });

    return {
      status: "reserved",
      items: normalizedItems,
      expiresAt,
    };
  });
}

export async function commitReservation(
  orderId: string,
  options: DomainOptions = {}
): Promise<CommitResult> {
  const now = new Date();

  return db.transaction(async (tx) => {
    if (options.messageId) {
      const claimed = await claimMessage(
        tx,
        options.messageId,
        options.source ?? "inventory.commit",
        now
      );
      if (!claimed) {
        return { status: "duplicate" } as CommitResult;
      }
    }

    const activeReservations = await loadActiveReservations(tx, orderId);
    if (activeReservations.length === 0) {
      return { status: "noop" };
    }

    const items = activeReservations.map((reservation) => ({
      sku: reservation.sku,
      qty: reservation.qty,
    }));

    for (const reservation of activeReservations) {
      await tx
        .update(inventoryBalance)
        .set({
          onHand: sql`GREATEST(${inventoryBalance.onHand} - ${reservation.qty}, 0)`,
          reserved: sql`GREATEST(${inventoryBalance.reserved} - ${reservation.qty}, 0)`,
          updatedAt: now,
        })
        .where(eq(inventoryBalance.sku, reservation.sku));
    }

    await tx
      .update(inventoryReservations)
      .set({
        status: RESERVATION_STATUS.COMMITTED,
        updatedAt: now,
      })
      .where(
        and(
          eq(inventoryReservations.reservationId, orderId),
          eq(inventoryReservations.status, RESERVATION_STATUS.ACTIVE)
        )
      );

    const committedEvent = makeInventoryEnvelope({
      type: InventoryEventType.StockCommittedV1,
      aggregateId: orderId,
      aggregateType: "reservation",
      payload: {
        orderId,
        items,
      },
      correlationId: options.correlationId,
      causationId: options.causationId,
    });

    await tx.insert(inventoryOutboxEvents).values({
      ...mapInventoryEventToOutboxRecord(committedEvent),
      createdAt: now,
      updatedAt: now,
    });

    return { status: "committed", items };
  });
}

export async function releaseReservation(
  orderId: string,
  reason: string,
  mode: ReleaseMode,
  options: DomainOptions = {}
): Promise<ReleaseResult> {
  const now = new Date();

  return db.transaction(async (tx) => {
    if (options.messageId) {
      const claimed = await claimMessage(
        tx,
        options.messageId,
        options.source ?? "inventory.release",
        now
      );
      if (!claimed) {
        return { status: "duplicate" } as ReleaseResult;
      }
    }

    const activeReservations = await loadActiveReservations(tx, orderId);
    if (activeReservations.length === 0) {
      return { status: "noop" };
    }

    const items = activeReservations.map((reservation) => ({
      sku: reservation.sku,
      qty: reservation.qty,
    }));

    for (const reservation of activeReservations) {
      await tx
        .update(inventoryBalance)
        .set({
          reserved: sql`GREATEST(${inventoryBalance.reserved} - ${reservation.qty}, 0)`,
          updatedAt: now,
        })
        .where(eq(inventoryBalance.sku, reservation.sku));
    }

    await tx
      .update(inventoryReservations)
      .set({
        status: mode === "expire" ? RESERVATION_STATUS.EXPIRED : RESERVATION_STATUS.RELEASED,
        updatedAt: now,
      })
      .where(
        and(
          eq(inventoryReservations.reservationId, orderId),
          eq(inventoryReservations.status, RESERVATION_STATUS.ACTIVE)
        )
      );

    const event =
      mode === "expire"
        ? makeInventoryEnvelope({
            type: InventoryEventType.StockReservationExpiredV1,
            aggregateId: orderId,
            aggregateType: "reservation",
            payload: {
              orderId,
              items,
              expiresAt: resolveReservationExpiry(activeReservations, now),
            },
            correlationId: options.correlationId,
            causationId: options.causationId,
          })
        : makeInventoryEnvelope({
            type: InventoryEventType.StockReservationReleasedV1,
            aggregateId: orderId,
            aggregateType: "reservation",
            payload: {
              orderId,
              reason,
              items,
            },
            correlationId: options.correlationId,
            causationId: options.causationId,
          });

    await tx.insert(inventoryOutboxEvents).values({
      ...mapInventoryEventToOutboxRecord(event),
      createdAt: now,
      updatedAt: now,
    });

    return {
      status: mode === "expire" ? "expired" : "released",
      items,
    };
  });
}

export async function expireReservations(batchSize = 50): Promise<number> {
  const now = new Date();
  const expired = await db
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.status, RESERVATION_STATUS.ACTIVE),
        lt(inventoryReservations.expiresAt, now)
      )
    )
    .limit(batchSize);

  const reservationIds = Array.from(new Set(expired.map((row) => row.reservationId)));
  let processed = 0;
  for (const reservationId of reservationIds) {
    const result = await releaseReservation(reservationId, "ttl_expired", "expire");
    if (result.status === "expired") {
      processed += 1;
    }
  }
  return processed;
}

async function claimMessage(
  tx: TransactionClient,
  messageId: string,
  source: string,
  now: Date
): Promise<boolean> {
  const inserted = await tx
    .insert(inventoryProcessedMessages)
    .values({
      messageId,
      source,
      processedAt: now,
    })
    .onConflictDoNothing()
    .returning({ messageId: inventoryProcessedMessages.messageId });

  return inserted.length > 0;
}

async function loadBalances(
  tx: TransactionClient,
  skus: string[]
): Promise<Map<string, { onHand: number; reserved: number }>> {
  if (skus.length === 0) {
    return new Map();
  }
  const records = await tx
    .select({
      sku: inventoryBalance.sku,
      onHand: inventoryBalance.onHand,
      reserved: inventoryBalance.reserved,
    })
    .from(inventoryBalance)
    .where(inArray(inventoryBalance.sku, skus));

  return new Map(records.map((record) => [record.sku, record]));
}

async function loadActiveReservations(
  tx: TransactionClient,
  orderId: string
): Promise<Array<typeof inventoryReservations.$inferSelect>> {
  return tx
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.reservationId, orderId),
        eq(inventoryReservations.status, RESERVATION_STATUS.ACTIVE)
      )
    );
}

function normalizeItems(items: ReservableItems): ReservableItems {
  const aggregates = new Map<string, number>();

  for (const item of items) {
    const sku = item.sku.trim();
    if (!sku || item.qty <= 0) {
      continue;
    }

    const current = aggregates.get(sku) ?? 0;
    aggregates.set(sku, current + item.qty);
  }

  return Array.from(aggregates.entries()).map(([sku, qty]) => ({ sku, qty }));
}

function resolveTtl(ttlSeconds?: number): number {
  if (!ttlSeconds || ttlSeconds <= 0) {
    return DEFAULT_RESERVATION_TTL_SECONDS;
  }
  return ttlSeconds;
}

function resolveReservationExpiry(
  reservations: Array<typeof inventoryReservations.$inferSelect>,
  fallback: Date
): string {
  const firstExpiry = reservations.find((reservation) => reservation.expiresAt)?.expiresAt;
  if (!firstExpiry) {
    return fallback.toISOString();
  }
  return firstExpiry instanceof Date
    ? firstExpiry.toISOString()
    : new Date(firstExpiry).toISOString();
}
