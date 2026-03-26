import { jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const catalog = pgSchema("catalog");
const auth = pgSchema("auth");
const orders = pgSchema("orders");

export const catalogCategories = catalog.table("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const catalogProducts = catalog.table("products", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  brand: text("brand"),
});

export const catalogProductCategories = catalog.table("product_categories", {
  productId: text("product_id").notNull(),
  categoryId: text("category_id").notNull(),
});

export const authUsers = auth.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

export const orderRecords = orders.table("orders", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  userId: text("user_id"),
  cartSnapshot: jsonb("cart_snapshot").notNull(),
  totals: jsonb("totals").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
