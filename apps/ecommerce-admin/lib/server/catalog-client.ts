"use server"

import "server-only"

import { mockCatalogProducts } from "@/lib/mock-data"
import type {
  CatalogListResponse,
  CatalogProduct,
  CatalogProductStatus,
} from "@/lib/types/catalog"

type ListCatalogParams = {
  q?: string
  status?: CatalogProductStatus | "all"
  limit?: number
  cursor?: string
}

const catalogBaseUrl =
  process.env.CATALOG_SERVICE_URL?.replace(/\/$/, "") ?? ""

const catalogAuthHeader = process.env.CATALOG_SERVICE_TOKEN
  ? { Authorization: `Bearer ${process.env.CATALOG_SERVICE_TOKEN}` }
  : undefined

export async function listCatalogProducts(
  params: ListCatalogParams = {}
): Promise<CatalogListResponse> {
  if (!catalogBaseUrl) {
    return listFromMock(params)
  }

  const url = new URL(`${catalogBaseUrl}/products`)
  if (params.q) url.searchParams.set("q", params.q)
  if (params.status && params.status !== "all")
    url.searchParams.set("status", params.status)
  if (params.limit) url.searchParams.set("limit", params.limit.toString())
  if (params.cursor) url.searchParams.set("cursor", params.cursor)

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...catalogAuthHeader,
    },
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(
      `Failed to load catalog products: ${res.status} ${res.statusText}`
    )
  }

  return (await res.json()) as CatalogListResponse
}

export async function getCatalogProduct(
  productId: string
): Promise<CatalogProduct | null> {
  if (!productId) return null

  if (!catalogBaseUrl) {
    return mockCatalogProducts.find((product) => product.id === productId) ?? null
  }

  const url = new URL(`${catalogBaseUrl}/products/${productId}`)
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...catalogAuthHeader,
    },
    cache: "no-store",
  })

  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(
      `Failed to load product ${productId}: ${res.status} ${res.statusText}`
    )
  }

  return (await res.json()) as CatalogProduct
}

function listFromMock(params: ListCatalogParams): CatalogListResponse {
  const status = params.status ?? "published"
  const query = params.q?.toLowerCase().trim()
  let items = mockCatalogProducts

  if (status !== "all") {
    items = items.filter((product) => product.status === status)
  }

  if (query) {
    items = items.filter((product) => {
      const haystack = [
        product.title,
        product.description ?? "",
        product.brand ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }

  const limit = params.limit ?? 20
  const sliced = items.slice(0, limit)

  return {
    items: sliced,
    nextCursor: items.length > limit ? "mock-cursor" : undefined,
  }
}
