import { SQL, and, asc, desc, ilike, or } from "drizzle-orm"
import { arrayOverlaps } from "drizzle-orm/sql/expressions/conditions"

import { productTable } from "@/db/schemas/catalog"
import { type CatalogSearchState } from "@/modules/catalog/lib/catalog-search-params"

export function buildProductFilterClause(filters: CatalogSearchState): SQL | undefined {
  const clauses: SQL[] = []

  if (filters.q) {
    const likeValue = `%${filters.q}%`
    const searchClause = or(
      ilike(productTable.name, likeValue),
      ilike(productTable.shortDescription, likeValue),
      ilike(productTable.category, likeValue)
    )

    if (searchClause) {
      clauses.push(searchClause)
    }
  }

  const tags = filters.tags
  if (tags.length) {
    clauses.push(arrayOverlaps(productTable.tags, tags))
  }

  return clauses.length ? and(...clauses) : undefined
}

export function buildProductOrdering(sort: CatalogSearchState["sort"]) {
  switch (sort) {
    case "price-asc":
      return [asc(productTable.price)]
    case "price-desc":
      return [desc(productTable.price)]
    case "new":
      return [desc(productTable.createdAt)]
    default:
      return [desc(productTable.featured), desc(productTable.createdAt)]
  }
}
