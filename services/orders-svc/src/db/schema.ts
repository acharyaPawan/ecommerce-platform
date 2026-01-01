import { pgSchema, pgTable, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

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
