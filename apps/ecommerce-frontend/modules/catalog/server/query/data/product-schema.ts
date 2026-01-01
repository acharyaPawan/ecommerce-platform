import { sql } from "drizzle-orm"
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

const frontend = pgSchema('frontend')


export const productTable = frontend.table("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortDescription: text("short_description").notNull(),
  story: text("story"),
  heroImage: text("hero_image").notNull(),
  gallery: jsonb("gallery").$type<string[]>().default([]),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  featured: boolean("featured").default(false).notNull(),
  rating: numeric("rating", { precision: 2, scale: 1 }).default("4.8"),
  reviewCount: integer("review_count").default(0),
  inventory: integer("inventory").default(0),
  category: text("category").notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  badges: text("badges").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const collectionTable = frontend.table("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  callout: text("callout"),
  heroImage: text("hero_image").notNull(),
  swatchOne: text("swatch_one").notNull(),
  swatchTwo: text("swatch_two").notNull(),
  metricLabel: text("metric_label").default("Bestsellers"),
  metricValue: text("metric_value").default("+120% YoY"),
})

export const editorialTable = frontend.table("editorials", {
  id: uuid("id").primaryKey().defaultRandom(),
  eyebrow: text("eyebrow").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  author: text("author"),
  ctaLabel: text("cta_label").default("Read the journal"),
  ctaHref: text("cta_href").default("/stories"),
  image: text("image").notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
})

export type ProductRecord = typeof productTable.$inferSelect
export type CollectionRecord = typeof collectionTable.$inferSelect
export type EditorialRecord = typeof editorialTable.$inferSelect
