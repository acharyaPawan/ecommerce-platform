import { and, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import db from "../db/index.js";
import {
  categories,
  media,
  prices,
  productCategories,
  products,
  variants,
} from "../db/schema.js";

type ProductRow = typeof products.$inferSelect;
type VariantRow = typeof variants.$inferSelect;
type PriceRow = typeof prices.$inferSelect;
type MediaRow = typeof media.$inferSelect;
type CategoryRow = typeof categories.$inferSelect;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type CatalogProduct = {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  categories: Array<{ id: string; name: string }>;
  media: Array<{ id: string; url: string; altText: string | null; sortOrder: number }>;
  variants: Array<{
    id: string;
    sku: string;
    status: string;
    attributes: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    prices: Array<{
      id: string;
      currency: string;
      amountCents: number;
      effectiveFrom: string;
    }>;
  }>;
};

export type ListProductsOptions = {
  limit?: number;
  cursor?: string;
  status?: "draft" | "published" | "archived";
  search?: string;
};

export type ListProductsResult = {
  items: CatalogProduct[];
  nextCursor?: string;
};

export type PricingQuoteInput = {
  sku: string;
  variantId?: string | null;
};

export type PricingQuote = {
  sku: string;
  variantId: string;
  unitPriceCents: number;
  currency: string;
  title: string | null;
};

export async function listProducts(options: ListProductsOptions = {}): Promise<ListProductsResult> {
  const limit = clamp(options.limit ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const cursor = parseCursor(options.cursor);
  const search = normalizeSearch(options.search);

  let whereClause: SQL<unknown> | undefined;
  const appendCondition = (condition: SQL<unknown>) => {
    whereClause = whereClause ? and(whereClause, condition) : condition;
  };

  if (options.status) {
    appendCondition(eq(products.status, options.status));
  }
  if (search) {
    const pattern = `%${search}%`;
    appendCondition(
      sql`(${products.title} ILIKE ${pattern} OR coalesce(${products.brand}, '') ILIKE ${pattern} OR coalesce(${products.description}, '') ILIKE ${pattern})`
    );
  }
  if (cursor) {
    const cursorDate = new Date(cursor.createdAt);
    if (!Number.isNaN(cursorDate.getTime())) {
      const cursorClause = or(
        lt(products.createdAt, cursorDate),
        and(eq(products.createdAt, cursorDate), lt(products.id, cursor.id))
      );
      appendCondition(cursorClause as SQL<unknown>);
    }
  }

  const baseQuery = db
    .select({
      id: products.id,
      title: products.title,
      description: products.description,
      brand: products.brand,
      status: products.status,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(limit + 1);

  const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery);
  const hasNext = rows.length > limit;
  const pageRows = hasNext ? rows.slice(0, limit) : rows;
  const items = await hydrateProducts(pageRows);

  return {
    items,
    nextCursor: hasNext ? encodeCursor(pageRows[pageRows.length - 1]!) : undefined,
  };
}

export async function getProduct(productId: string): Promise<CatalogProduct | null> {
  if (!productId.trim()) {
    return null;
  }

  const [record] = await db
    .select({
      id: products.id,
      title: products.title,
      description: products.description,
      brand: products.brand,
      status: products.status,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!record) {
    return null;
  }

  const [product] = await hydrateProducts([record]);
  return product ?? null;
}

export async function quotePricing(items: PricingQuoteInput[]): Promise<PricingQuote[]> {
  if (items.length === 0) {
    return [];
  }

  const variantIds = Array.from(
    new Set(items.map((item) => item.variantId).filter((value): value is string => Boolean(value)))
  );
  const skus = Array.from(
    new Set(items.filter((item) => !item.variantId).map((item) => item.sku))
  );

  if (variantIds.length === 0 && skus.length === 0) {
    return [];
  }

  const conditions: SQL<unknown>[] = [];
  if (variantIds.length) {
    conditions.push(inArray(variants.id, variantIds));
  }
  if (skus.length) {
    conditions.push(inArray(variants.sku, skus));
  }

  const variantRows = await db
    .select({
      id: variants.id,
      sku: variants.sku,
      productId: variants.productId,
      title: products.title,
    })
    .from(variants)
    .leftJoin(products, eq(variants.productId, products.id))
    .where(conditions.length === 1 ? conditions[0]! : or(...conditions));

  if (variantRows.length === 0) {
    return [];
  }

  const variantById = new Map(variantRows.map((row) => [row.id, row]));
  const variantBySku = new Map(variantRows.map((row) => [row.sku, row]));
  const variantIdList = variantRows.map((row) => row.id);

  const priceRows = await db
    .select({
      variantId: prices.variantId,
      amountCents: prices.amountCents,
      currency: prices.currency,
      effectiveFrom: prices.effectiveFrom,
      createdAt: prices.createdAt,
    })
    .from(prices)
    .where(inArray(prices.variantId, variantIdList))
    .orderBy(desc(prices.effectiveFrom), desc(prices.createdAt));

  const priceByVariant = new Map<string, { amountCents: number; currency: string }>();
  for (const row of priceRows) {
    if (!priceByVariant.has(row.variantId)) {
      priceByVariant.set(row.variantId, {
        amountCents: row.amountCents,
        currency: row.currency,
      });
    }
  }

  return items.map((item) => {
    const variant = item.variantId
      ? variantById.get(item.variantId)
      : variantBySku.get(item.sku);

    if (!variant) {
      throw new Error(`Variant not found for SKU ${item.sku}`);
    }

    const price = priceByVariant.get(variant.id);
    if (!price) {
      throw new Error(`Missing price for SKU ${variant.sku}`);
    }

    return {
      sku: variant.sku,
      variantId: variant.id,
      unitPriceCents: price.amountCents,
      currency: price.currency,
      title: variant.title ?? null,
    };
  });
}

async function hydrateProducts(rows: ProductRow[]): Promise<CatalogProduct[]> {
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map((row) => row.id);

  const variantRows = await db.select().from(variants).where(inArray(variants.productId, ids));
  const variantIds = variantRows.map((variant) => variant.id);
  const [priceRows, mediaRows, categoryRows] = await Promise.all([
    variantIds.length
      ? db.select().from(prices).where(inArray(prices.variantId, variantIds))
      : Promise.resolve([] as PriceRow[]),
    db
      .select()
      .from(media)
      .where(inArray(media.productId, ids))
      .orderBy(media.sortOrder, media.createdAt),
    db
      .select({
        productId: productCategories.productId,
        categoryId: categories.id,
        name: categories.name,
      })
      .from(productCategories)
      .innerJoin(categories, eq(productCategories.categoryId, categories.id))
      .where(inArray(productCategories.productId, ids)),
  ]);

  const variantsByProduct = groupByProduct(variantRows);
  const pricesByVariant = groupPrices(priceRows);
  const mediaByProduct = groupMedia(mediaRows);
  const categoriesByProduct = groupCategories(categoryRows);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    brand: row.brand ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    categories: categoriesByProduct.get(row.id) ?? [],
    media: mediaByProduct.get(row.id) ?? [],
    variants: (variantsByProduct.get(row.id) ?? []).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      status: variant.status,
      attributes: variant.attributes,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
      prices: (pricesByVariant.get(variant.id) ?? []).map((price) => ({
        id: price.id,
        currency: price.currency,
        amountCents: price.amountCents,
        effectiveFrom: price.effectiveFrom.toISOString(),
      })),
    })),
  }));
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

type CursorPayload = {
  id: string;
  createdAt: string;
};

const encodeCursor = (row: ProductRow): string =>
  Buffer.from(
    JSON.stringify({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    })
  ).toString("base64url");

const parseCursor = (raw?: string | null): CursorPayload | null => {
  if (!raw) {
    return null;
  }
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as CursorPayload;
    if (!payload.id || !payload.createdAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const normalizeSearch = (input?: string | null): string | undefined => {
  if (!input) return undefined;
  const trimmed = input.trim();
  return trimmed.length ? trimmed : undefined;
};

function groupByProduct(rows: VariantRow[]): Map<string, VariantRow[]> {
  const map = new Map<string, VariantRow[]>();
  for (const row of rows) {
    const bucket = map.get(row.productId);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(row.productId, [row]);
    }
  }
  return map;
}

function groupPrices(rows: PriceRow[]): Map<string, PriceRow[]> {
  const map = new Map<string, PriceRow[]>();
  for (const row of rows) {
    const bucket = map.get(row.variantId);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(row.variantId, [row]);
    }
  }
  for (const pricesList of map.values()) {
    pricesList.sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
  }
  return map;
}

function groupMedia(rows: MediaRow[]): Map<string, CatalogProduct["media"]> {
  const map = new Map<string, CatalogProduct["media"]>();
  for (const row of rows) {
    const entry = {
      id: row.id,
      url: row.url,
      altText: row.altText ?? null,
      sortOrder: row.sortOrder,
    };
    const bucket = map.get(row.productId);
    if (bucket) {
      bucket.push(entry);
    } else {
      map.set(row.productId, [entry]);
    }
  }
  for (const mediaList of map.values()) {
    mediaList.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return map;
}

function groupCategories(
  rows: Array<{ productId: string; categoryId: CategoryRow["id"]; name: CategoryRow["name"] }>
): Map<string, Array<{ id: string; name: string }>> {
  const map = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of rows) {
    const entry = { id: row.categoryId, name: row.name };
    const bucket = map.get(row.productId);
    if (bucket) {
      bucket.push(entry);
    } else {
      map.set(row.productId, [entry]);
    }
  }
  return map;
}
