"use server"

import "server-only"

import {
  ServiceRequestError,
  serviceFetch,
} from "@/lib/server/service-client"
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

export async function listCatalogProducts(
  params: ListCatalogParams = {}
): Promise<CatalogListResponse> {
  return serviceFetch<CatalogListResponse>({
    service: "catalog",
    path: "/products",
    searchParams: {
      q: params.q,
      status: params.status === "all" ? undefined : params.status,
      limit: params.limit,
      cursor: params.cursor,
    },
  })
}

export async function getCatalogProduct(
  productId: string
): Promise<CatalogProduct | null> {
  if (!productId) return null

  try {
    return await serviceFetch<CatalogProduct>({
      service: "catalog",
      path: `/products/${productId}`,
    })
  } catch (error) {
    if (error instanceof ServiceRequestError && error.status === 404) {
      return null
    }
    throw error
  }
}
