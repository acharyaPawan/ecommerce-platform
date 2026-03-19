import type { InteractionEventType } from "@ecommerce/events"

export type RecommendationBehaviorExplanation = {
  basis: "related_behavior" | "personal_behavior" | "popular_fallback"
  summary: string
  reasons: string[]
  contributingActors: number
  seedProductIds?: string[]
  anchorProductId?: string
}

export type RelatedProductRecommendation = {
  productId: string
  score: number
  supportingSignals: number
  strongestEventType: InteractionEventType
  explanation: RecommendationBehaviorExplanation
}

export type RelatedProductRecommendationsResponse = {
  items: RelatedProductRecommendation[]
}

export type PersonalProductRecommendationsResponse = {
  items: RelatedProductRecommendation[]
  seedProductIds: string[]
}
