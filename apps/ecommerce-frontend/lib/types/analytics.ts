import type { InteractionEventType } from "@ecommerce/events"

export type RelatedProductRecommendation = {
  productId: string
  score: number
  supportingSignals: number
  strongestEventType: InteractionEventType
}

export type RelatedProductRecommendationsResponse = {
  items: RelatedProductRecommendation[]
}
