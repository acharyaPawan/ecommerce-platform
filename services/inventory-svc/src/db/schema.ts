import {
  pgSchema,
  pgTable,
  primaryKey,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const inventory = pgSchema("inventory");

export const inventoryBalance = inventory.table("inventory_balance", {
  sku: text("sku").primaryKey(),
  onHand: integer("on_hand").default(0).notNull(),
  reserved: integer("reserved").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const inventoryReservations = inventory.table(
  "inventory_reservations",
  {
    reservationId: text("reservation_id").notNull(),
    sku: text("sku").notNull(),
    qty: integer("qty").notNull(),
    status: text("status").default("ACTIVE").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.reservationId, table.sku] }),
  })
);

export const inventoryProcessedMessages = inventory.table("processed_messages", {
  messageId: text("message_id").primaryKey(),
  source: text("source").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryOutboxEvents = pgTable("inventory_outbox_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  aggregateType: text("aggregate_type").default("inventory").notNull(),
  payload: jsonb("payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  correlationId: text("correlation_id"),
  causationId: text("causation_id"),
  status: text("status").default("pending").notNull(),
  error: text("error"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
