import type { CatalogProduct, CatalogVariant } from "@/lib/types/catalog"

export function getPrimaryVariant(product: CatalogProduct): CatalogVariant | null {
  return product.variants[0] ?? null
}

export function getPrimaryPrice(variant: CatalogVariant | null) {
  return variant?.prices?.[0] ?? null
}

export function getProductImage(product: CatalogProduct) {
  return product.media[0]?.url ?? null
}
