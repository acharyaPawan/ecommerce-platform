"use server"

import "server-only"

import {
  GatewayRequestError,
  gatewayFetch,
} from "@/lib/server/gateway-client"
import type {
  CatalogListResponse,
  CatalogProduct,
  CatalogProductInput,
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
  return gatewayFetch<CatalogListResponse>({
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
    return await gatewayFetch<CatalogProduct>({
      path: `/products/${productId}`,
    })
  } catch (error) {
    if (
      error instanceof GatewayRequestError &&
      error.status === 404
    ) {
      return null
    }
    throw error
  }
}

export async function createCatalogProduct(payload: CatalogProductInput) {
  return gatewayFetch<{ productId: string }>({
    path: "/products",
    method: "POST",
    body: JSON.stringify(payload),
    idempotency: true,
  })
}

export async function updateCatalogProduct(
  productId: string,
  payload: Partial<CatalogProductInput>
) {
  if (!productId) throw new Error("Product ID is required.")
  return gatewayFetch<CatalogProduct>({
    path: `/products/${productId}`,
    method: "PATCH",
    body: JSON.stringify(payload),
    idempotency: true,
  })
}
