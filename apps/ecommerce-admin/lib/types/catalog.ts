export type CatalogProductStatus = "draft" | "published" | "archived"

export interface CatalogMedia {
  id: string
  url: string
  altText?: string | null
  sortOrder: number
}

export interface CatalogPrice {
  id: string
  currency: string
  amountCents: number
  effectiveFrom: string
}

export interface CatalogPriceInput {
  currency: string
  amountCents: number
  effectiveFrom?: string
}

export interface CatalogVariant {
  id: string
  sku: string
  status: "active" | "discontinued"
  attributes: Record<string, string>
  prices: CatalogPrice[]
}

export interface CatalogVariantInput {
  sku: string
  status?: "active" | "discontinued"
  attributes?: Record<string, string>
  prices: CatalogPriceInput[]
}

export interface CatalogProduct {
  id: string
  title: string
  description?: string | null
  brand?: string | null
  status: CatalogProductStatus
  categories: Array<{ id: string; name: string }>
  media: CatalogMedia[]
  variants: CatalogVariant[]
  createdAt: string
  updatedAt: string
}

export interface CatalogProductInput {
  title: string
  description?: string | null
  brand?: string | null
  status?: CatalogProductStatus
  categories?: Array<{ id: string; name: string }>
  media?: Array<{
    url: string
    altText?: string | null
    sortOrder?: number
  }>
  variants: CatalogVariantInput[]
}

export interface CatalogListResponse {
  items: CatalogProduct[]
  nextCursor?: string
}
