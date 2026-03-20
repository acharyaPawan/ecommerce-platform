export type InteractionEventType =
  | "view"
  | "click"
  | "wishlist_add"
  | "cart_add"
  | "purchase"
  | "rating"
  | "review"

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

export type RecommendationInspectionSnapshot = {
  generatedAt: string
  lookbackDays: number
  sampleAnchorCount: number
  metrics: {
    totalInteractions: number
    uniqueUsers: number
    uniqueSessions: number
    uniqueActors: number
    uniqueProducts: number
    eventTypeBreakdown: Record<InteractionEventType, number>
    recommendationCount: number
    collaborativeCount: number
    fallbackCount: number
    lowSupportCount: number
    diversifiedCount: number
    fallbackRate: number
    lowSupportRate: number
    diversifiedRate: number
    stageBreakdown: Record<
      RecommendationDiagnostics["selectionStage"],
      number
    >
  }
  anchors: Array<{
    productId: string
    interactionCount: number
    recommendations: RelatedProductRecommendation[]
  }>
}

export type CategoryDemandForecast = {
  categoryId: string
  categoryName: string
  totalObservedUnits: number
  avgDailyUnits: number
  recentWindowUnits: number
  previousWindowUnits: number
  trendPct: number
  projectedUnits: number
  confidence: "high" | "medium" | "low"
  history: Array<{ date: string; units: number }>
  forecast: Array<{ date: string; units: number }>
}

export type CategoryForecastSnapshot = {
  generatedAt: string
  lookbackDays: number
  horizonDays: number
  categories: CategoryDemandForecast[]
}
