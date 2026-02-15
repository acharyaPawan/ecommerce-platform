import { Buffer } from "node:buffer";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db from "../db/index.js";
import {
  orderIdempotencyKeys,
  orders,
  ordersOutboxEvents,
  ordersProcessedMessages,
} from "../db/schema.js";
import type { CartSnapshotPayload } from "./schemas.js";
import { OrderEventType, makeOrderEnvelope } from "./events.js";
import { mapOrderEventToOutboxRecord } from "./outbox.js";

const CREATE_ORDER_OPERATION = "orders.create";
export const ORDER_STATUS = {
  PendingInventory: "pending_inventory",
  Confirmed: "confirmed",
  Rejected: "rejected",
  Canceled: "canceled",
} as const;
type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OrderRow = typeof orders.$inferSelect;

export type OrderRecord = {
  id: string;
  status: OrderStatus;
  currency: string;
  userId: string | null;
  cartSnapshot: CartSnapshotPayload;
  totals: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  canceledAt: Date | null;
  cancellationReason: string | null;
};

export type CreateOrderOptions = {
  idempotencyKey?: string;
  snapshotSecret: string;
  correlationId?: string;
  reservationTtlSeconds?: number;
};

export type CreateOrderResult = {
  orderId: string;
  idempotent: boolean;
};

export async function createOrder(
  snapshot: CartSnapshotPayload,
  options: CreateOrderOptions
): Promise<CreateOrderResult> {
  const now = new Date();
  const orderId = randomUUID();

  return db.transaction(async (tx) => {
    if (options.idempotencyKey) {
      const idempotency = await ensureIdempotencyRecord(
        tx,
        options.idempotencyKey,
        CREATE_ORDER_OPERATION,
        now
      );
      if (idempotency?.status === "replay") {
        return { orderId: idempotency.response.orderId, idempotent: true };
      }
    }

    if (!verifySnapshotSignature(snapshot, options.snapshotSecret)) {
      throw new Error("Invalid snapshot signature");
    }

    await tx.insert(orders).values({
      id: orderId,
      status: ORDER_STATUS.PendingInventory,
      currency: snapshot.currency.toUpperCase(),
      userId: snapshot.userId ?? null,
      cartSnapshot: snapshot,
      totals: snapshot.totals,
      createdAt: now,
      updatedAt: now,
    });

    const placedEvent = makeOrderEnvelope({
      type: OrderEventType.OrderPlacedV1,
      aggregateId: orderId,
      correlationId: options.correlationId,
      payload: {
        orderId,
        items: snapshot.items.map((item) => ({
          sku: item.sku,
          qty: item.qty,
        })),
        ttlSeconds: options.reservationTtlSeconds,
      },
    });

    await tx.insert(ordersOutboxEvents).values({
      ...mapOrderEventToOutboxRecord(placedEvent),
      createdAt: now,
      updatedAt: now,
    });

    if (options.idempotencyKey) {
      await markIdempotencyRecordCompleted(tx, options.idempotencyKey, CREATE_ORDER_OPERATION, {
        orderId,
      });
    }

    return { orderId, idempotent: false };
  });
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  const [record] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  return record ? mapOrder(record) : null;
}

type CancelOrderResult =
  | { status: "not_found" }
  | { status: "already_finalized"; order: OrderRecord }
  | { status: "canceled"; order: OrderRecord };

type CancelOrderOptions = {
  correlationId?: string;
};

export async function cancelOrder(
  orderId: string,
  reason?: string,
  options: CancelOrderOptions = {}
): Promise<CancelOrderResult> {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!record) {
      return { status: "not_found" } as const;
    }
    if (record.status === ORDER_STATUS.Canceled || record.status === ORDER_STATUS.Rejected) {
      return { status: "already_finalized", order: mapOrder(record) } as const;
    }

    await tx
      .update(orders)
      .set({
        status: ORDER_STATUS.Canceled,
        cancellationReason: reason ?? null,
        canceledAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    const canceledEvent = makeOrderEnvelope({
      type: OrderEventType.OrderCanceledV1,
      aggregateId: orderId,
      correlationId: options.correlationId,
      payload: {
        orderId,
        reason: reason ?? null,
        canceledAt: now.toISOString(),
      },
    });

    await tx.insert(ordersOutboxEvents).values({
      ...mapOrderEventToOutboxRecord(canceledEvent),
      createdAt: now,
      updatedAt: now,
    });

    const [updated] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    return {
      status: "canceled",
      order: mapOrder(updated ?? record),
    } as const;
  });
}

export type InventoryReservedInput = {
  orderId: string;
  messageId: string;
  source: string;
};

export async function markOrderInventoryReserved(
  input: InventoryReservedInput
): Promise<"updated" | "ignored"> {
  const now = new Date();

  return db.transaction(async (tx) => {
    const claimed = await claimMessage(tx, input.messageId, input.source, now);
    if (!claimed) {
      return "ignored";
    }

    const updated = await tx
      .update(orders)
      .set({
        status: ORDER_STATUS.Confirmed,
        updatedAt: now,
      })
      .where(and(eq(orders.id, input.orderId), eq(orders.status, ORDER_STATUS.PendingInventory)))
      .returning({ id: orders.id });

    return updated.length > 0 ? "updated" : "ignored";
  });
}

export type InventoryReservationFailedInput = {
  orderId: string;
  reason: string;
  messageId: string;
  source: string;
};

export async function markOrderInventoryReservationFailed(
  input: InventoryReservationFailedInput
): Promise<"updated" | "ignored"> {
  const now = new Date();

  return db.transaction(async (tx) => {
    const claimed = await claimMessage(tx, input.messageId, input.source, now);
    if (!claimed) {
      return "ignored";
    }

    const updated = await tx
      .update(orders)
      .set({
        status: ORDER_STATUS.Rejected,
        cancellationReason: `inventory:${input.reason}`,
        updatedAt: now,
      })
      .where(and(eq(orders.id, input.orderId), eq(orders.status, ORDER_STATUS.PendingInventory)))
      .returning({ id: orders.id });

    return updated.length > 0 ? "updated" : "ignored";
  });
}

type IdempotencyEnsureResult =
  | { status: "new" }
  | { status: "replay"; response: { orderId: string } };

async function ensureIdempotencyRecord(
  tx: TransactionClient,
  key: string,
  operation: string,
  now: Date
): Promise<IdempotencyEnsureResult> {
  const inserted = await tx
    .insert(orderIdempotencyKeys)
    .values({
      id: randomUUID(),
      key,
      operation,
      status: "processing",
      responsePayload: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [orderIdempotencyKeys.key, orderIdempotencyKeys.operation],
    })
    .returning({ id: orderIdempotencyKeys.id });

  if (inserted.length > 0) {
    return { status: "new" };
  }

  const [existing] = await tx
    .select()
    .from(orderIdempotencyKeys)
    .where(and(eq(orderIdempotencyKeys.key, key), eq(orderIdempotencyKeys.operation, operation)))
    .limit(1);

  if (existing && existing.status === "completed" && existing.responsePayload) {
    return {
      status: "replay",
      response: existing.responsePayload as { orderId: string },
    };
  }

  throw new Error("Idempotent request is already processing");
}

async function markIdempotencyRecordCompleted(
  tx: TransactionClient,
  key: string,
  operation: string,
  response: { orderId: string }
): Promise<void> {
  await tx
    .update(orderIdempotencyKeys)
    .set({
      status: "completed",
      responsePayload: response,
      updatedAt: new Date(),
    })
    .where(and(eq(orderIdempotencyKeys.key, key), eq(orderIdempotencyKeys.operation, operation)));
}

async function claimMessage(
  tx: TransactionClient,
  messageId: string,
  source: string,
  now: Date
): Promise<boolean> {
  const inserted = await tx
    .insert(ordersProcessedMessages)
    .values({
      messageId,
      source,
      processedAt: now,
    })
    .onConflictDoNothing({
      target: [ordersProcessedMessages.messageId],
    })
    .returning({ messageId: ordersProcessedMessages.messageId });

  return inserted.length > 0;
}

function verifySnapshotSignature(snapshot: CartSnapshotPayload, secret: string): boolean {
  const { signature, ...rest } = snapshot;
  if (!signature) {
    return false;
  }

  const computed = createHmac("sha256", secret)
    .update(JSON.stringify(rest))
    .digest();

  if (signature.length !== computed.length * 2) {
    return false;
  }

  const provided = Buffer.from(signature, "hex");
  if (provided.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(provided, computed);
}

function mapOrder(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    status: row.status as OrderStatus,
    currency: row.currency,
    userId: row.userId ?? null,
    cartSnapshot: row.cartSnapshot as CartSnapshotPayload,
    totals: row.totals as Record<string, unknown>,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt ?? Date.now()),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt ?? Date.now()),
    canceledAt: row.canceledAt
      ? row.canceledAt instanceof Date
        ? row.canceledAt
        : new Date(row.canceledAt)
      : null,
    cancellationReason: row.cancellationReason ?? null,
  };
}
