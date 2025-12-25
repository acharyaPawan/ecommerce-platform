import { randomUUID } from "node:crypto";
import db from "../db/index.js";
import {
  catalogOutboxEvents,
  categories,
  media,
  prices,
  productCategories,
  products,
  variants,
} from "../db/schema.js";
import type { CreateProductInput } from "./schemas.js";
import { CatalogEventType, makeCatalogEnvelope } from "./events.js";
import { mapCatalogEventToOutboxRecord } from "./outbox.js";

type CreateProductOptions = {
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
};

export async function createProduct(
  input: CreateProductInput,
  options: CreateProductOptions = {}
): Promise<{ productId: string }> {
  const now = new Date();
  const productId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(products).values({
      id: productId,
      title: input.title,
      description: input.description ?? null,
      brand: input.brand ?? null,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    });

    const categoryMap = new Map(
      (input.categories ?? []).map((category) => [
        category.id,
        {
          id: category.id,
          name: category.name ?? category.id,
          createdAt: now,
          updatedAt: now,
        },
      ])
    );
    const categoryRecords = Array.from(categoryMap.values());

    if (categoryRecords.length > 0) {
      await tx
        .insert(categories)
        .values(categoryRecords)
        .onConflictDoNothing({ target: categories.id });

      const productCategoryRecords = categoryRecords.map((category) => ({
        productId,
        categoryId: category.id,
        createdAt: now,
      }));

      await tx
        .insert(productCategories)
        .values(productCategoryRecords)
        .onConflictDoNothing();
    }

    const mediaRecords = (input.media ?? []).map((item, index) => ({
      id: randomUUID(),
      productId,
      url: item.url,
      altText: item.altText ?? null,
      sortOrder: item.sortOrder ?? index,
      createdAt: now,
    }));

    if (mediaRecords.length > 0) {
      await tx.insert(media).values(mediaRecords);
    }

    const variantRecords = input.variants.map((variant) => ({
      id: randomUUID(),
      productId,
      sku: variant.sku,
      status: variant.status,
      attributes: variant.attributes,
      createdAt: now,
      updatedAt: now,
    }));

    await tx.insert(variants).values(variantRecords);

    const priceRecords = variantRecords.flatMap((variant, index) =>
      input.variants[index].prices.map((price) => ({
        id: randomUUID(),
        variantId: variant.id,
        currency: price.currency,
        amountCents: price.amountCents,
        effectiveFrom: price.effectiveFrom ? new Date(price.effectiveFrom) : now,
        createdAt: now,
      }))
    );

    if (priceRecords.length > 0) {
      await tx.insert(prices).values(priceRecords);
    }

    const variantSkuById = new Map(variantRecords.map((variant) => [variant.id, variant.sku]));

    const createdEvent = makeCatalogEnvelope({
      type: CatalogEventType.ProductCreatedV1,
      aggregateId: productId,
      aggregateType: "product",
      correlationId: options.correlationId,
      causationId: options.causationId,
      payload: {
        product: {
          id: productId,
          title: input.title,
          description: input.description ?? null,
          brand: input.brand ?? null,
          status: input.status,
          createdAt: now.toISOString(),
        },
        variants: variantRecords.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          status: variant.status,
          attributes: variant.attributes,
        })),
        prices: priceRecords.map((priceRecord) => ({
          id: priceRecord.id,
          variantId: priceRecord.variantId,
          sku: variantSkuById.get(priceRecord.variantId) ?? "",
          currency: priceRecord.currency,
          amountCents: priceRecord.amountCents,
          effectiveFrom: priceRecord.effectiveFrom.toISOString(),
        })),
        categories: categoryRecords.map((category) => category.id),
        media: mediaRecords.map((item) => ({
          id: item.id,
          url: item.url,
          sortOrder: item.sortOrder,
          altText: item.altText,
        })),
      },
    });

    await tx.insert(catalogOutboxEvents).values({
      ...mapCatalogEventToOutboxRecord(createdEvent),
      createdAt: now,
      updatedAt: now,
    });
  });

  return { productId };
}
