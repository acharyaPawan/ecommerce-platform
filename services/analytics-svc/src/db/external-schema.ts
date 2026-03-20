import { pgSchema, text } from "drizzle-orm/pg-core";

const catalog = pgSchema("catalog");

export const catalogCategories = catalog.table("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const catalogProductCategories = catalog.table("product_categories", {
  productId: text("product_id").notNull(),
  categoryId: text("category_id").notNull(),
});
