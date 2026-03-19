"use server"

import "server-only"

import { serviceFetch } from "@/lib/server/service-client"
import type { RecommendationInspectionSnapshot } from "@/lib/types/analytics"

export async function getRecommendationInspectionSnapshot(options: {
  lookbackDays?: number
  sampleAnchorLimit?: number
  recommendationLimit?: number
} = {}): Promise<RecommendationInspectionSnapshot> {
  return serviceFetch<RecommendationInspectionSnapshot>({
    service: "analytics",
    path: "/recommendations/inspection",
    searchParams: {
      lookbackDays: options.lookbackDays,
      sampleAnchorLimit: options.sampleAnchorLimit,
      recommendationLimit: options.recommendationLimit,
    },
  })
}
