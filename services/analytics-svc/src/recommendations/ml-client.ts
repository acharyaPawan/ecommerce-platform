import { z } from "zod";

const rerankResultSchema = z.object({
  product_id: z.string(),
  final_score: z.number(),
  behavior_score: z.number(),
  content_score: z.number(),
  summary: z.string(),
  reasons: z.array(z.string()),
});

const rerankResponseSchema = z.object({
  items: z.array(rerankResultSchema),
});

export type MlProductFeatures = {
  productId: string;
  title: string;
  description: string | null;
  brand: string | null;
  categoryIds: string[];
};

export type MlRecommendationCandidate = {
  productId: string;
  behaviorScore: number;
  supportingSignals: number;
  strongestEventType: string;
  product: MlProductFeatures;
};

export async function rerankRecommendationsWithMlService(input: {
  baseUrl: string;
  mode: "related" | "personal";
  anchorProduct?: MlProductFeatures;
  seedProducts?: MlProductFeatures[];
  candidates: MlRecommendationCandidate[];
}): Promise<
  Array<{
    productId: string;
    finalScore: number;
    behaviorScore: number;
    contentScore: number;
    summary: string;
    reasons: string[];
  }>
> {
  const response = await fetch(`${input.baseUrl}/api/recommendations/rerank`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mode: input.mode,
      anchor_product: input.anchorProduct
        ? {
            product_id: input.anchorProduct.productId,
            title: input.anchorProduct.title,
            description: input.anchorProduct.description,
            brand: input.anchorProduct.brand,
            category_ids: input.anchorProduct.categoryIds,
          }
        : undefined,
      seed_products: (input.seedProducts ?? []).map((product) => ({
        product_id: product.productId,
        title: product.title,
        description: product.description,
        brand: product.brand,
        category_ids: product.categoryIds,
      })),
      candidates: input.candidates.map((candidate) => ({
        product_id: candidate.productId,
        behavior_score: candidate.behaviorScore,
        supporting_signals: candidate.supportingSignals,
        strongest_event_type: candidate.strongestEventType,
        product: {
          product_id: candidate.product.productId,
          title: candidate.product.title,
          description: candidate.product.description,
          brand: candidate.product.brand,
          category_ids: candidate.product.categoryIds,
        },
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`ml recommendation rerank failed with status ${response.status}`);
  }

  const payload = rerankResponseSchema.parse(await response.json());
  return payload.items.map((item) => ({
    productId: item.product_id,
    finalScore: item.final_score,
    behaviorScore: item.behavior_score,
    contentScore: item.content_score,
    summary: item.summary,
    reasons: item.reasons,
  }));
}
