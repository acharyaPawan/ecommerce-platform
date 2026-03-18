"use server"

import "server-only"

import { serviceFetch } from "@/lib/server/service-client"
import type {
  PersonalProductRecommendationsResponse,
  RelatedProductRecommendationsResponse,
} from "@/lib/types/analytics"

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

export async function getPersonalProductRecommendations(options: {
  userId?: string
  sessionId?: string
  limit?: number
}): Promise<PersonalProductRecommendationsResponse> {
  return serviceFetch<PersonalProductRecommendationsResponse>({
    service: "analytics",
    path: "/recommendations/for-you",
    searchParams: {
      userId: options.userId,
      sessionId: options.sessionId,
      limit: options.limit,
    },
  })
}
