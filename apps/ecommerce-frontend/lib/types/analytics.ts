import type { InteractionEventType } from "@ecommerce/events"

export type RecommendationBehaviorExplanation = {
  basis: "related_behavior" | "personal_behavior" | "popular_fallback"
  summary: string
  reasons: string[]
  contributingActors: number
  seedProductIds?: string[]
  anchorProductId?: string
}

export type RecommendationDiagnostics = {
  source: "collaborative" | "popular_fallback"
  selectionStage:
    | "primary_diversified"
    | "primary_relaxed"
    | "low_support_backfill"
    | "popular_backfill"
  rawBehaviorScore: number
  fallbackUsed: boolean
  actorThresholdPassed: boolean
  diversifiedBySignal: boolean
  contributingActors: number
}

export type RelatedProductRecommendation = {
  productId: string
  score: number
  supportingSignals: number
  strongestEventType: InteractionEventType
  explanation: RecommendationBehaviorExplanation
  diagnostics: RecommendationDiagnostics
}

export type RelatedProductRecommendationsResponse = {
  items: RelatedProductRecommendation[]
}

export type PersonalProductRecommendationsResponse = {
  items: RelatedProductRecommendation[]
  seedProductIds: string[]
}
