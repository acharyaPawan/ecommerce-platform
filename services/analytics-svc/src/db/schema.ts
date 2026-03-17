import {
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const analytics = pgSchema("analytics");

export const interactionEvents = analytics.table(
  "interaction_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    source: text("source").notNull(),
    userId: text("user_id"),
    sessionId: text("session_id"),
    productId: text("product_id").notNull(),
    variantId: text("variant_id"),
    properties: jsonb("properties").$type<Record<string, unknown>>().default({}).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("analytics_interaction_events_product_occurred_at_idx").on(
      table.productId,
      table.occurredAt
    ),
    index("analytics_interaction_events_user_occurred_at_idx").on(
      table.userId,
      table.occurredAt
    ),
    index("analytics_interaction_events_session_occurred_at_idx").on(
      table.sessionId,
      table.occurredAt
    ),
  ]
);

export const interactionIngestionKeys = analytics.table(
  "interaction_ingestion_keys",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    eventId: text("event_id")
      .notNull()
      .references(() => interactionEvents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("analytics_interaction_ingestion_keys_key_idx").on(table.key)]
);
