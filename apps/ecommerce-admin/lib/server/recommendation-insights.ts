"use server"

import "server-only"

import { getCatalogProduct } from "@/lib/server/catalog-client"
import { getRecommendationInspectionSnapshot } from "@/lib/server/analytics-client"
import { withServiceAuthFromRequest } from "@/lib/server/service-auth"

export type RecommendationInspectorData = {
  snapshot: Awaited<ReturnType<typeof getRecommendationInspectionSnapshot>>
  anchors: Array<{
    productId: string
    productTitle: string
    interactionCount: number
    recommendations: Array<{
      productId: string
      productTitle: string
      strongestEventType: string
      supportingSignals: number
      score: number
      explanationSummary: string
      diagnostics: Awaited<
        ReturnType<typeof getRecommendationInspectionSnapshot>
      >["anchors"][number]["recommendations"][number]["diagnostics"]
    }>
  }>
}

export async function getRecommendationInspectorData(): Promise<RecommendationInspectorData> {
  return withServiceAuthFromRequest(async () => {
    const snapshot = await getRecommendationInspectionSnapshot({
      lookbackDays: 30,
      sampleAnchorLimit: 4,
      recommendationLimit: 4,
    })

    const anchors = await Promise.all(
      snapshot.anchors.map(async (anchor) => {
        const anchorProduct = await getCatalogProduct(anchor.productId)
        const recommendations = await Promise.all(
          anchor.recommendations.map(async (recommendation) => {
            const product = await getCatalogProduct(recommendation.productId)
            return {
              productId: recommendation.productId,
              productTitle: product?.title ?? recommendation.productId,
              strongestEventType: recommendation.strongestEventType,
              supportingSignals: recommendation.supportingSignals,
              score: recommendation.score,
              explanationSummary: recommendation.explanation.summary,
              diagnostics: recommendation.diagnostics,
            }
          })
        )

        return {
          productId: anchor.productId,
          productTitle: anchorProduct?.title ?? anchor.productId,
          interactionCount: anchor.interactionCount,
          recommendations,
        }
      })
    )

    return {
      snapshot,
      anchors,
    }
  })
}
