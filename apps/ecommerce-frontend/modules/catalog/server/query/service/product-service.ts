import { cache } from "react"

import { sql } from "drizzle-orm"

import { collectionTable, editorialTable, productTable } from "@/db/schemas/catalog"
import { db } from "@/lib/drizzle/client"
import { type CatalogSearchState } from "@/modules/catalog/lib/catalog-search-params"
import {
  mapCollectionRecord,
  mapEditorialRecord,
  mapProductRecord,
} from "@/modules/catalog/lib/product-mapper"

import {
  curatedCollections,
  editorialStories,
  productShowcase,
} from "../data/product-static"
import { buildProductFilterClause, buildProductOrdering } from "../dsl/product-dsl"
import {
  type CollectionDTO,
  type EditorialDTO,
  type ProductDTO,
} from "../dto/product-dto"

export type StorefrontData = {
  hero: ProductDTO
  featuredProducts: ProductDTO[]
  supportingProducts: ProductDTO[]
  collections: CollectionDTO[]
  stories: EditorialDTO[]
}

export const loadStorefrontData = cache(
  async (filters: CatalogSearchState): Promise<StorefrontData> => {
    const [products, collections, stories] = await Promise.all([
      loadProducts(filters),
      loadCollections(),
      loadStories(),
    ])

    return {
      hero: products[0] ?? mapProductRecord(productShowcase[0]!),
      featuredProducts: products.slice(0, 4),
      supportingProducts: products.slice(4, 12),
      collections,
      stories,
    }
  }
)

async function loadProducts(filters: CatalogSearchState): Promise<ProductDTO[]> {
  if (!db) {
    return productShowcase.map(mapProductRecord)
  }

  try {
    const clause = buildProductFilterClause(filters)
    const orderBy = buildProductOrdering(filters.sort)
    const rows = await db
      .select()
      .from(productTable)
      .where(clause ?? sql`true`)
      .orderBy(...orderBy)
      .limit(12)
    if (!rows.length) {
      return productShowcase.map(mapProductRecord)
    }

    return rows.map(mapProductRecord)
  } catch {
    return productShowcase.map(mapProductRecord)
  }
}

async function loadCollections(): Promise<CollectionDTO[]> {
  if (!db) {
    return curatedCollections.map(mapCollectionRecord)
  }

  try {
    const rows = await db.select().from(collectionTable).limit(3)
    return rows.map(mapCollectionRecord)
  } catch {
    return curatedCollections.map(mapCollectionRecord)
  }
}

async function loadStories(): Promise<EditorialDTO[]> {
  if (!db) {
    return editorialStories.map(mapEditorialRecord)
  }

  try {
    const rows = await db.select().from(editorialTable).limit(2)
    return rows.map(mapEditorialRecord)
  } catch {
    return editorialStories.map(mapEditorialRecord)
  }
}
