import { SQL, and, asc, desc, ilike, or, sql } from "drizzle-orm"

import { type CatalogSearchState } from "@/modules/catalog/lib/catalog-search-params"

import { productTable } from "../data/product-schema"

export function buildProductFilterClause(filters: CatalogSearchState): SQL | undefined {
  const clauses: SQL[] = []

  if (filters.q) {
    const likeValue = `%${filters.q}%`
    clauses.push(
      or(
        ilike(productTable.name, likeValue),
        ilike(productTable.shortDescription, likeValue),
        ilike(productTable.category, likeValue)
      )
    )
  }

  if (filters.tags?.length) {
    clauses.push(sql`${productTable.tags} && ${filters.tags}`)
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
