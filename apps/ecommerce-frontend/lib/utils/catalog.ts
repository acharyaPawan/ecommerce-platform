import type { CatalogProduct, CatalogVariant } from "@/lib/types/catalog"

export function getPrimaryVariant(product: CatalogProduct): CatalogVariant | null {
  return product.variants[0] ?? null
}

export function getPrimaryPrice(variant: CatalogVariant | null) {
  return variant?.prices?.[0] ?? null
}

export function getUsableImageUrl(url?: string | null): string | null {
  const value = url?.trim()
  if (!value) return null

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }
    // Seed data relies heavily on loremflickr and it is unreliable in local dev.
    if (parsed.hostname.includes("loremflickr.com")) {
      return null
    }
    return value
  } catch {
    return null
  }
}

export function getProductImage(product: CatalogProduct) {
  return getUsableImageUrl(product.media[0]?.url)
}
