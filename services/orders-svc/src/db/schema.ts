import { pgSchema, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export const ordersSchema = pgSchema("orders");

export const orders = ordersSchema.table("orders", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  currency: text("currency").notNull(),
  userId: text("user_id"),
  cartSnapshot: jsonb("cart_snapshot").notNull(),
  totals: jsonb("totals").notNull(),
  cancellationReason: text("cancellation_reason"),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderIdempotencyKeys = ordersSchema.table(
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
    keyOperationIdx: uniqueIndex("orders_idempotency_key_operation_idx").on(table.key, table.operation),
  })
);

export const ordersOutboxEvents = ordersSchema.table("orders_outbox_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  aggregateType: text("aggregate_type").default("order").notNull(),
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

export const ordersProcessedMessages = ordersSchema.table("processed_messages", {
  messageId: text("message_id").primaryKey(),
  source: text("source").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});
