import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db from "../db/index.js";
import { paymentIdempotencyKeys, payments, paymentsOutboxEvents } from "../db/schema.js";
import { PaymentEventType, makePaymentEnvelope } from "./events.js";
import { mapPaymentEventToOutboxRecord } from "./outbox.js";

const AUTHORIZE_PAYMENT_OPERATION = "payments.authorize";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PaymentRow = typeof payments.$inferSelect;

export type PaymentRecord = {
  id: string;
  orderId: string;
  status: string;
  amountCents: number;
  currency: string;
  failureReason: string | null;
  failedAt: Date | null;
  capturedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthorizePaymentInput = {
  orderId: string;
  amountCents: number;
  currency: string;
};

export type AuthorizePaymentOptions = {
  idempotencyKey?: string;
  correlationId?: string;
};

export type AuthorizePaymentResult = {
  paymentId: string;
  idempotent: boolean;
};

export async function authorizePayment(
  input: AuthorizePaymentInput,
  options: AuthorizePaymentOptions = {}
): Promise<AuthorizePaymentResult> {
  const now = new Date();
  const paymentId = randomUUID();

  return db.transaction(async (tx) => {
    if (options.idempotencyKey) {
      const idempotency = await ensureIdempotencyRecord(
        tx,
        options.idempotencyKey,
        AUTHORIZE_PAYMENT_OPERATION,
        now
      );
      if (idempotency?.status === "replay") {
        return { paymentId: idempotency.response.paymentId, idempotent: true };
      }
    }

    await tx.insert(payments).values({
      id: paymentId,
      orderId: input.orderId,
      status: "authorized",
      amountCents: input.amountCents,
      currency: input.currency.toUpperCase(),
      createdAt: now,
      updatedAt: now,
    });

    const authorizedEvent = makePaymentEnvelope({
      type: PaymentEventType.PaymentAuthorizedV1,
      aggregateId: paymentId,
      correlationId: options.correlationId,
      payload: {
        paymentId,
        orderId: input.orderId,
        amountCents: input.amountCents,
        currency: input.currency.toUpperCase(),
      },
    });

    await tx.insert(paymentsOutboxEvents).values({
      ...mapPaymentEventToOutboxRecord(authorizedEvent),
      createdAt: now,
      updatedAt: now,
    });

    if (options.idempotencyKey) {
      await markIdempotencyRecordCompleted(tx, options.idempotencyKey, AUTHORIZE_PAYMENT_OPERATION, {
        paymentId,
      });
    }

    return { paymentId, idempotent: false };
  });
}

type PaymentStatusResult =
  | { status: "not_found" }
  | { status: "already_finalized"; payment: PaymentRecord }
  | { status: "updated"; payment: PaymentRecord };

type PaymentUpdateOptions = {
  correlationId?: string;
};

export async function failPayment(
  paymentId: string,
  reason?: string,
  options: PaymentUpdateOptions = {}
): Promise<PaymentStatusResult> {
  const now = new Date();

  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!record) {
      return { status: "not_found" } as const;
    }

    if (record.status === "failed" || record.status === "captured") {
      return { status: "already_finalized", payment: mapPayment(record) } as const;
    }

    await tx
      .update(payments)
      .set({
        status: "failed",
        failureReason: reason ?? null,
        failedAt: now,
        updatedAt: now,
      })
      .where(eq(payments.id, paymentId));

    const failedEvent = makePaymentEnvelope({
      type: PaymentEventType.PaymentFailedV1,
      aggregateId: paymentId,
      correlationId: options.correlationId,
      payload: {
        paymentId,
        orderId: record.orderId,
        reason: reason ?? null,
        failedAt: now.toISOString(),
      },
    });

    await tx.insert(paymentsOutboxEvents).values({
      ...mapPaymentEventToOutboxRecord(failedEvent),
      createdAt: now,
      updatedAt: now,
    });

    const [updated] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    return { status: "updated", payment: mapPayment(updated ?? record) } as const;
  });
}

export async function capturePayment(
  paymentId: string,
  options: PaymentUpdateOptions = {}
): Promise<PaymentStatusResult> {
  const now = new Date();

  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!record) {
      return { status: "not_found" } as const;
    }

    if (record.status !== "authorized") {
      return { status: "already_finalized", payment: mapPayment(record) } as const;
    }

    await tx
      .update(payments)
      .set({
        status: "captured",
        capturedAt: now,
        updatedAt: now,
      })
      .where(eq(payments.id, paymentId));

    const capturedEvent = makePaymentEnvelope({
      type: PaymentEventType.PaymentCapturedV1,
      aggregateId: paymentId,
      correlationId: options.correlationId,
      payload: {
        paymentId,
        orderId: record.orderId,
        capturedAt: now.toISOString(),
      },
    });

    await tx.insert(paymentsOutboxEvents).values({
      ...mapPaymentEventToOutboxRecord(capturedEvent),
      createdAt: now,
      updatedAt: now,
    });

    const [updated] = await tx.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    return { status: "updated", payment: mapPayment(updated ?? record) } as const;
  });
}

export async function listPayments(orderId?: string): Promise<PaymentRecord[]> {
  const query = db.select().from(payments);
  if (orderId) {
    const results = await query.where(eq(payments.orderId, orderId)).orderBy(payments.createdAt);
    return results.map(mapPayment);
  }

  const results = await query.orderBy(payments.createdAt);
  return results.map(mapPayment);
}

type IdempotencyEnsureResult =
  | { status: "new" }
  | { status: "replay"; response: { paymentId: string } };

async function ensureIdempotencyRecord(
  tx: TransactionClient,
  key: string,
  operation: string,
  now: Date
): Promise<IdempotencyEnsureResult> {
  const inserted = await tx
    .insert(paymentIdempotencyKeys)
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
      target: [paymentIdempotencyKeys.key, paymentIdempotencyKeys.operation],
    })
    .returning({ id: paymentIdempotencyKeys.id });

  if (inserted.length > 0) {
    return { status: "new" };
  }

  const [existing] = await tx
    .select()
    .from(paymentIdempotencyKeys)
    .where(and(eq(paymentIdempotencyKeys.key, key), eq(paymentIdempotencyKeys.operation, operation)))
    .limit(1);

  if (existing && existing.status === "completed" && existing.responsePayload) {
    return {
      status: "replay",
      response: existing.responsePayload as { paymentId: string },
    };
  }

  throw new Error("Idempotent request is already processing");
}

async function markIdempotencyRecordCompleted(
  tx: TransactionClient,
  key: string,
  operation: string,
  response: { paymentId: string }
): Promise<void> {
  await tx
    .update(paymentIdempotencyKeys)
    .set({
      status: "completed",
      responsePayload: response,
      updatedAt: new Date(),
    })
    .where(and(eq(paymentIdempotencyKeys.key, key), eq(paymentIdempotencyKeys.operation, operation)));
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    orderId: row.orderId,
    status: row.status,
    amountCents: row.amountCents,
    currency: row.currency,
    failureReason: row.failureReason ?? null,
    failedAt: row.failedAt
      ? row.failedAt instanceof Date
        ? row.failedAt
        : new Date(row.failedAt)
      : null,
    capturedAt: row.capturedAt
      ? row.capturedAt instanceof Date
        ? row.capturedAt
        : new Date(row.capturedAt)
      : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt ?? Date.now()),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt ?? Date.now()),
  };
}
