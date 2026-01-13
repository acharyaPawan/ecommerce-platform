import "server-only"

import { listCatalogProducts } from "@/lib/server/catalog-client"
import type { CatalogProduct } from "@/lib/types/catalog"

export type CategorySummary = {
  id: string
  name: string
  count: number
}

export type StorefrontData = {
  products: CatalogProduct[]
  categories: CategorySummary[]
  query?: string
  activeCategory?: string
}

type StorefrontFilters = {
  query?: string
  category?: string
}

function buildCategorySummary(products: CatalogProduct[]): CategorySummary[] {
  const map = new Map<string, CategorySummary>()
  for (const product of products) {
    for (const category of product.categories) {
      const existing = map.get(category.id)
      if (existing) {
        existing.count += 1
      } else {
        map.set(category.id, {
          id: category.id,
          name: category.name,
          count: 1,
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

function filterByCategory(
  products: CatalogProduct[],
  categoryId?: string
): CatalogProduct[] {
  if (!categoryId) return products
  return products.filter((product) =>
    product.categories.some((category) => category.id === categoryId)
  )
}

export async function loadStorefrontData(
  filters: StorefrontFilters = {}
): Promise<StorefrontData> {
  const { items } = await listCatalogProducts({
    q: filters.query,
    status: "published",
    limit: 60,
  })

  const categories = buildCategorySummary(items)
  const filtered = filterByCategory(items, filters.category)

  return {
    products: filtered,
    categories,
    query: filters.query,
    activeCategory: filters.category,
  }
}
