"use server"

import "server-only"

import { serviceFetch } from "@/lib/server/service-client"
import type { RelatedProductRecommendationsResponse } from "@/lib/types/analytics"

export async function getRelatedProductRecommendations(
  productId: string,
  options: { limit?: number } = {}
): Promise<RelatedProductRecommendationsResponse> {
  return serviceFetch<RelatedProductRecommendationsResponse>({
    service: "analytics",
    path: `/recommendations/products/${productId}/related`,
    searchParams: {
      limit: options.limit,
    },
  })
}
