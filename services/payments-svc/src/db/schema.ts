import { pgSchema, pgTable, text, timestamp, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const paymentsSchema = pgSchema("payments");

export const payments = paymentsSchema.table("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  status: text("status").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  failureReason: text("failure_reason"),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const paymentIdempotencyKeys = paymentsSchema.table(
  "idempotency_keys",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    operation: text("operation").notNull(),
    status: text("status").default("processing").notNull(),
    responsePayload: jsonb("response_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    keyOperationIdx: uniqueIndex("payments_idempotency_key_operation_idx").on(table.key, table.operation),
  })
);

export const paymentsOutboxEvents = paymentsSchema.table("payments_outbox_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  aggregateType: text("aggregate_type").default("payment").notNull(),
  payload: jsonb("payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  correlationId: text("correlation_id"),
  causationId: text("causation_id"),
  status: text("status").default("pending").notNull(),
  error: text("error"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
