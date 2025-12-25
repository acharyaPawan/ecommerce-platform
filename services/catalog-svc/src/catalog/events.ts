import { randomUUID } from "node:crypto";

export enum CatalogEventType {
  ProductCreatedV1 = "catalog.product.created.v1",
  ProductUpdatedV1 = "catalog.product.updated.v1",
  ProductPublishedV1 = "catalog.product.published.v1",
  ProductUnpublishedV1 = "catalog.product.unpublished.v1",
  ProductArchivedV1 = "catalog.product.archived.v1",
  VariantCreatedV1 = "catalog.variant.created.v1",
  VariantUpdatedV1 = "catalog.variant.updated.v1",
  VariantDiscontinuedV1 = "catalog.variant.discontinued.v1",
  PriceChangedV1 = "catalog.price.changed.v1",
}

export type CatalogAggregateType = "product" | "variant" | "price" | "category";

export type CatalogEnvelope<TType extends CatalogEventType, TPayload> = {
  id: string;
  type: TType;
  aggregateType: CatalogAggregateType;
  aggregateId: string;
  occurredAt: string;
  version: 1;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
};

export type ProductCreatedV1 = CatalogEnvelope<
  CatalogEventType.ProductCreatedV1,
  {
    product: {
      id: string;
      title: string;
      description: string | null;
      brand: string | null;
      status: string;
      createdAt: string;
    };
    variants: Array<{
      id: string;
      sku: string;
      status: string;
      attributes: Record<string, unknown>;
    }>;
    prices: Array<{
      id: string;
      variantId: string;
      sku: string;
      currency: string;
      amountCents: number;
      effectiveFrom: string;
    }>;
    categories: string[];
    media: Array<{
      id: string;
      url: string;
      sortOrder: number;
      altText: string | null;
    }>;
  }
>;

export type ProductUpdatedV1 = CatalogEnvelope<
  CatalogEventType.ProductUpdatedV1,
  {
    productId: string;
    updatedFields: Record<string, unknown>;
    updatedAt: string;
  }
>;

export type ProductPublishedV1 = CatalogEnvelope<
  CatalogEventType.ProductPublishedV1,
  {
    productId: string;
    publishedAt: string;
  }
>;

export type ProductUnpublishedV1 = CatalogEnvelope<
  CatalogEventType.ProductUnpublishedV1,
  {
    productId: string;
    unpublishedAt: string;
  }
>;

export type ProductArchivedV1 = CatalogEnvelope<
  CatalogEventType.ProductArchivedV1,
  {
    productId: string;
    archivedAt: string;
  }
>;

export type VariantCreatedV1 = CatalogEnvelope<
  CatalogEventType.VariantCreatedV1,
  {
    productId: string;
    variant: {
      id: string;
      sku: string;
      status: string;
      attributes: Record<string, unknown>;
    };
  }
>;

export type VariantUpdatedV1 = CatalogEnvelope<
  CatalogEventType.VariantUpdatedV1,
  {
    variantId: string;
    productId: string;
    updatedFields: Record<string, unknown>;
    updatedAt: string;
  }
>;

export type VariantDiscontinuedV1 = CatalogEnvelope<
  CatalogEventType.VariantDiscontinuedV1,
  {
    variantId: string;
    productId: string;
    discontinuedAt: string;
  }
>;

export type PriceChangedV1 = CatalogEnvelope<
  CatalogEventType.PriceChangedV1,
  {
    priceId: string;
    variantId: string;
    sku: string;
    currency: string;
    amountCents: number;
    effectiveFrom: string;
    previousAmountCents?: number | null;
    previousEffectiveFrom?: string | null;
  }
>;

export type AnyCatalogEvent =
  | ProductCreatedV1
  | ProductUpdatedV1
  | ProductPublishedV1
  | ProductUnpublishedV1
  | ProductArchivedV1
  | VariantCreatedV1
  | VariantUpdatedV1
  | VariantDiscontinuedV1
  | PriceChangedV1;

export function makeCatalogEnvelope<TType extends CatalogEventType, TPayload>(args: {
  type: TType;
  aggregateId: string;
  aggregateType?: CatalogAggregateType;
  payload: TPayload;
  correlationId?: string;
  causationId?: string;
}): CatalogEnvelope<TType, TPayload> {
  return {
    id: randomUUID(),
    type: args.type,
    aggregateType: args.aggregateType ?? "product",
    aggregateId: args.aggregateId,
    occurredAt: new Date().toISOString(),
    version: 1,
    correlationId: args.correlationId,
    causationId: args.causationId,
    payload: args.payload,
  };
}
