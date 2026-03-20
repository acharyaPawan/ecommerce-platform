"use server"

import "server-only"

import { serviceFetch } from "@/lib/server/service-client"
import type {
  CategoryForecastSnapshot,
  RecommendationInspectionSnapshot,
} from "@/lib/types/analytics"

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

export async function getCategoryForecastSnapshot(options: {
  lookbackDays?: number
  horizonDays?: number
  limit?: number
} = {}): Promise<CategoryForecastSnapshot> {
  return serviceFetch<CategoryForecastSnapshot>({
    service: "analytics",
    path: "/forecasts/categories",
    searchParams: {
      lookbackDays: options.lookbackDays,
      horizonDays: options.horizonDays,
      limit: options.limit,
    },
  })
}
