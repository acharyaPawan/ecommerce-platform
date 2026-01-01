import {
  productDtoSchema,
  type CollectionDTO,
  collectionDtoSchema,
  type EditorialDTO,
  editorialDtoSchema,
  type ProductDTO,
} from "@/modules/catalog/server/query/dto/product-dto"
import {
  type CollectionRecord,
  type EditorialRecord,
  type ProductRecord,
} from "@/db/schemas/catalog"

export function mapProductRecord(record: ProductRecord): ProductDTO {
  return productDtoSchema.parse({
    id: record.id,
    slug: record.slug,
    name: record.name,
    shortDescription: record.shortDescription,
    story: record.story ?? undefined,
    heroImage: record.heroImage,
    gallery: record.gallery ?? [],
    price: Number(record.price ?? 0),
    priceLabel: formatCurrency(Number(record.price ?? 0), record.currency),
    currency: record.currency ?? "USD",
    rating: Number(record.rating ?? 0),
    reviewCount: record.reviewCount ?? 0,
    inventory: record.inventory ?? 0,
    category: record.category,
    tags: record.tags ?? [],
    badges: record.badges ?? [],
    featured: record.featured ?? false,
  })
}

export function mapCollectionRecord(record: CollectionRecord): CollectionDTO {
  return collectionDtoSchema.parse({
    id: record.id,
    title: record.title,
    description: record.description,
    callout: record.callout ?? undefined,
    heroImage: record.heroImage,
    swatches: [record.swatchOne, record.swatchTwo],
    metricLabel: record.metricLabel ?? "Bestsellers",
    metricValue: record.metricValue ?? "Trending",
  })
}

export function mapEditorialRecord(record: EditorialRecord): EditorialDTO {
  return editorialDtoSchema.parse({
    id: record.id,
    eyebrow: record.eyebrow,
    title: record.title,
    description: record.description,
    author: record.author,
    ctaLabel: record.ctaLabel ?? "Read the journal",
    ctaHref: record.ctaHref ?? "/stories",
    image: record.image,
  })
}

function formatCurrency(value: number, currency = "USD") {
  return Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}
