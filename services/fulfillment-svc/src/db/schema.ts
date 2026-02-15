import { pgSchema, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const fulfillment = pgSchema("fulfillment");

export const shipments = fulfillment.table(
  "shipments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull(),
    status: text("status").notNull(),
    carrier: text("carrier").notNull(),
    trackingNumber: text("tracking_number").notNull(),
    trackingUrl: text("tracking_url").notNull(),
    shippedAt: timestamp("shipped_at", { withTimezone: true, mode: "date" }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => ({
    orderIdUniqueIdx: uniqueIndex("shipments_order_id_unique_idx").on(table.orderId),
  })
);
