import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db from "../db/index.js";
import {
  catalogIdempotencyKeys,
  catalogOutboxEvents,
  categories,
  media,
  prices,
  productCategories,
  products,
  variants,
} from "../db/schema.js";
import type { CreateProductInput, UpdateProductInput } from "./schemas.js";
import { CatalogEventType, makeCatalogEnvelope } from "./events.js";
import { mapCatalogEventToOutboxRecord } from "./outbox.js";

type CreateProductOptions = {
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
};

const CREATE_PRODUCT_OPERATION = "catalog.create_product";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CreateProductResult = {
  productId: string;
  idempotent: boolean;
};

export async function createProduct(
  input: CreateProductInput,
  options: CreateProductOptions = {}
): Promise<CreateProductResult> {
  const now = new Date();
  const productId = randomUUID();

  const result = await db.transaction(async (tx) => {
    if (options.idempotencyKey) {
      const idempotency = await ensureIdempotencyRecord(
        tx,
        options.idempotencyKey,
        CREATE_PRODUCT_OPERATION,
        now
      );

      if (idempotency?.status === "replay") {
        return { productId: idempotency.response.productId, idempotent: true } satisfies CreateProductResult;
      }
    }

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
    if (options.idempotencyKey) {
      await markIdempotencyRecordCompleted(tx, options.idempotencyKey, CREATE_PRODUCT_OPERATION, {
        productId,
      });
    }

    return { productId, idempotent: false } satisfies CreateProductResult;
  });

  return result;
}

type UpdateProductOptions = {
  correlationId?: string;
  causationId?: string;
};

type UpdateProductResult =
  | { status: "updated"; productId: string; updatedFields: Record<string, unknown> }
  | { status: "not_found" };

export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
  options: UpdateProductOptions = {}
): Promise<UpdateProductResult> {
  const normalizedProductId = productId.trim();
  if (!normalizedProductId) {
    throw new Error("Product ID is required");
  }

  const updatedFields: Record<string, unknown> = {};
  if (input.title !== undefined) {
    updatedFields.title = input.title;
  }
  if (input.description !== undefined) {
    updatedFields.description = input.description;
  }
  if (input.brand !== undefined) {
    updatedFields.brand = input.brand;
  }
  if (input.status !== undefined) {
    updatedFields.status = input.status;
  }

  if (Object.keys(updatedFields).length === 0) {
    return { status: "updated", productId: normalizedProductId, updatedFields: {} };
  }

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(products)
      .set({
        ...updatedFields,
        updatedAt: now,
      })
      .where(eq(products.id, normalizedProductId))
      .returning({ id: products.id });

    if (!updated) {
      return { status: "not_found" } as UpdateProductResult;
    }

    const event = makeCatalogEnvelope({
      type: CatalogEventType.ProductUpdatedV1,
      aggregateId: normalizedProductId,
      aggregateType: "product",
      correlationId: options.correlationId,
      causationId: options.causationId,
      payload: {
        productId: normalizedProductId,
        updatedFields,
        updatedAt: now.toISOString(),
      },
    });

    await tx.insert(catalogOutboxEvents).values({
      ...mapCatalogEventToOutboxRecord(event),
      createdAt: now,
      updatedAt: now,
    });

    return {
      status: "updated",
      productId: normalizedProductId,
      updatedFields,
    } as UpdateProductResult;
  });

  return result;
}

type IdempotencyEnsureResult =
  | { status: "new" }
  | { status: "replay"; response: { productId: string } };

async function ensureIdempotencyRecord(
  tx: TransactionClient,
  key: string,
  operation: string,
  now: Date
): Promise<IdempotencyEnsureResult> {
  const inserted = await tx
    .insert(catalogIdempotencyKeys)
    .values({
      id: randomUUID(),
      key,
      operation,
      status: "processing",
      responsePayload: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [catalogIdempotencyKeys.key, catalogIdempotencyKeys.operation],
    })
    .returning({ id: catalogIdempotencyKeys.id });

  if (inserted.length > 0) {
    return { status: "new" };
  }

  const existing = await tx
    .select()
    .from(catalogIdempotencyKeys)
    .where(
      and(
        eq(catalogIdempotencyKeys.key, key),
        eq(catalogIdempotencyKeys.operation, operation)
      )
    )
    .limit(1);

  const record = existing.at(0);
  if (record && record.status === "completed" && record.responsePayload) {
    return {
      status: "replay",
      response: record.responsePayload as { productId: string },
    };
  }

  throw new Error("Idempotent request is already processing");
}

async function markIdempotencyRecordCompleted(
  tx: TransactionClient,
  key: string,
  operation: string,
  response: { productId: string }
): Promise<void> {
  await tx
    .update(catalogIdempotencyKeys)
    .set({
      status: "completed",
      responsePayload: response,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(catalogIdempotencyKeys.key, key),
        eq(catalogIdempotencyKeys.operation, operation)
      )
    );
}
