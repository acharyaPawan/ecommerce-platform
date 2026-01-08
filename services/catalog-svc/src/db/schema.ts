import {
  pgSchema,
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const catalog = pgSchema("catalog");

export const products = catalog.table("products", {
  id: text("id").primaryKey(),
  status: text("status").default("draft").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  brand: text("brand"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const variants = catalog.table(
  "variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    status: text("status").default("active").notNull(),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    skuIdx: uniqueIndex("variants_sku_idx").on(table.sku),
  })
);

export const prices = catalog.table("prices", {
  id: text("id").primaryKey(),
  variantId: text("variant_id")
    .notNull()
    .references(() => variants.id, { onDelete: "cascade" }),
  currency: text("currency").notNull(),
  amountCents: integer("amount_cents").notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const media = catalog.table("media", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const categories = catalog.table("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const productCategories = catalog.table(
  "product_categories",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.productId, table.categoryId] }),
  })
);

export const catalogIdempotencyKeys = catalog.table(
  "idempotency_keys",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    operation: text("operation").notNull(),
    status: text("status").default("processing").notNull(),
    responsePayload: jsonb("response_payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    keyOperationIdx: uniqueIndex("catalog_idempotency_key_operation_idx").on(table.key, table.operation),
  })
);

export const catalogOutboxEvents = catalog.table("catalog_outbox_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  aggregateType: text("aggregate_type").default("product").notNull(),
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
