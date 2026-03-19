import type { CatalogProduct } from "@/lib/types/catalog"
import type { RelatedProductRecommendation } from "@/lib/types/analytics"
import { getPrimaryPrice } from "@/lib/utils/catalog"

export type RecommendationExplanation = {
  summary: string
  reasons: string[]
}

export type RankedRecommendation = RelatedProductRecommendation & {
  hybridScore: number
  contentScore: number
  collaborativeScore: number
  explanation: RecommendationExplanation
}

export function rerankRelatedHybrid(
  anchor: CatalogProduct,
  candidates: CatalogProduct[],
  recommendations: RelatedProductRecommendation[]
): RankedRecommendation[] {
  // Normalize collaborative scores so they can be blended with content scores on the same 0..1 scale.
  const collaborativeScores = normalizeRecommendationScores(recommendations)

  return candidates
    .map((candidate) => {
      const recommendation = recommendations.find((item) => item.productId === candidate.id)
      if (!recommendation) {
        return null
      }

      const collaborativeScore = collaborativeScores.get(candidate.id) ?? 0
      const contentScore = scoreContentSimilarity(anchor, candidate)
      // Related lists prioritize collaborative evidence while still nudging toward catalog similarity.
      const hybridScore = collaborativeScore * 0.7 + contentScore * 0.3

      return {
        ...recommendation,
        collaborativeScore,
        contentScore,
        hybridScore,
        explanation: buildRelatedExplanation({
          anchor,
          candidate,
          recommendation,
          collaborativeScore,
          contentScore,
        }),
      }
    })
    .filter((item): item is RankedRecommendation => Boolean(item))
    .sort((a, b) => b.hybridScore - a.hybridScore)
}

export function rerankPersonalizedHybrid(
  seedProducts: CatalogProduct[],
  candidates: CatalogProduct[],
  recommendations: RelatedProductRecommendation[]
): RankedRecommendation[] {
  const collaborativeScores = normalizeRecommendationScores(recommendations)
  // Build a lightweight preference profile from recent seed products.
  const profile = buildProfile(seedProducts)

  return candidates
    .map((candidate) => {
      const recommendation = recommendations.find((item) => item.productId === candidate.id)
      if (!recommendation) {
        return null
      }

      const collaborativeScore = collaborativeScores.get(candidate.id) ?? 0
      const contentScore = scoreProfileSimilarity(profile, candidate)
      // Personalized feeds lean a bit more on collaborative behavior than product attributes.
      const hybridScore = collaborativeScore * 0.75 + contentScore * 0.25

      return {
        ...recommendation,
        collaborativeScore,
        contentScore,
        hybridScore,
        explanation: buildPersonalizedExplanation({
          seedProducts,
          candidate,
          recommendation,
          collaborativeScore,
          contentScore,
        }),
      }
    })
    .filter((item): item is RankedRecommendation => Boolean(item))
    .sort((a, b) => b.hybridScore - a.hybridScore)
}

function normalizeRecommendationScores(
  recommendations: RelatedProductRecommendation[]
): Map<string, number> {
  const scores = recommendations.map((item) => item.score)
  const min = scores.length > 0 ? Math.min(...scores) : 0
  const max = scores.length > 0 ? Math.max(...scores) : 1
  const range = max - min || 1

  // Min-max normalization keeps ranking order while preventing raw score magnitude from dominating.
  return new Map(
    recommendations.map((item) => [item.productId, (item.score - min) / range])
  )
}

function scoreContentSimilarity(anchor: CatalogProduct, candidate: CatalogProduct): number {
  const categoryScore = overlapRatio(
    anchor.categories.map((item) => item.id),
    candidate.categories.map((item) => item.id)
  )
  const brandScore =
    anchor.brand && candidate.brand && anchor.brand === candidate.brand ? 1 : 0
  const titleTokenScore = overlapRatio(tokenize(anchor.title), tokenize(candidate.title))
  const descriptionTokenScore = overlapRatio(
    tokenize(anchor.description ?? ""),
    tokenize(candidate.description ?? "")
  )
  const priceScore = scorePriceSimilarity(anchor, candidate)

  return roundScore(
    categoryScore * 0.35 +
      brandScore * 0.2 +
      titleTokenScore * 0.2 +
      descriptionTokenScore * 0.1 +
      priceScore * 0.15
  )
}

function buildProfile(products: CatalogProduct[]) {
  const categories = new Map<string, number>()
  const brands = new Map<string, number>()
  const tokens = new Map<string, number>()
  const prices: number[] = []

  // Frequency maps act as implicit preferences: repeated exposure increases influence.
  for (const product of products) {
    for (const category of product.categories) {
      categories.set(category.id, (categories.get(category.id) ?? 0) + 1)
    }
    if (product.brand) {
      brands.set(product.brand, (brands.get(product.brand) ?? 0) + 1)
    }
    for (const token of [...tokenize(product.title), ...tokenize(product.description ?? "")]) {
      tokens.set(token, (tokens.get(token) ?? 0) + 1)
    }
    const price = getPrimaryPrice(product.variants[0] ?? null)?.amountCents
    if (typeof price === "number") {
      prices.push(price)
    }
  }

  return {
    categories,
    brands,
    tokens,
    averagePrice:
      prices.length > 0 ? prices.reduce((sum, value) => sum + value, 0) / prices.length : undefined,
  }
}

function scoreProfileSimilarity(
  profile: ReturnType<typeof buildProfile>,
  candidate: CatalogProduct
): number {
  const categoryScore = weightedMembership(
    profile.categories,
    candidate.categories.map((item) => item.id)
  )
  const brandScore = candidate.brand ? weightedMembership(profile.brands, [candidate.brand]) : 0
  const tokenScore = weightedMembership(
    profile.tokens,
    [...tokenize(candidate.title), ...tokenize(candidate.description ?? "")]
  )
  const priceScore = scorePriceToProfile(profile.averagePrice, candidate)

  return roundScore(
    categoryScore * 0.4 + brandScore * 0.2 + tokenScore * 0.25 + priceScore * 0.15
  )
}

function weightedMembership(weights: Map<string, number>, values: string[]): number {
  if (weights.size === 0 || values.length === 0) {
    return 0
  }

  const totalWeight = Array.from(weights.values()).reduce((sum, value) => sum + value, 0) || 1
  const matchedWeight = values.reduce(
    (sum, value) => sum + (weights.get(value) ?? 0),
    0
  )

  // Cap at 1 so very long candidate token lists cannot exceed the expected scoring range.
  return roundScore(Math.min(matchedWeight / totalWeight, 1))
}

function overlapRatio(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0
  }

  const leftSet = new Set(left)
  const rightSet = new Set(right)
  let overlap = 0
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      overlap += 1
    }
  }

  return roundScore(overlap / Math.max(leftSet.size, rightSet.size, 1))
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function scorePriceSimilarity(left: CatalogProduct, right: CatalogProduct): number {
  const leftPrice = getPrimaryPrice(left.variants[0] ?? null)?.amountCents
  const rightPrice = getPrimaryPrice(right.variants[0] ?? null)?.amountCents
  if (typeof leftPrice !== "number" || typeof rightPrice !== "number") {
    return 0
  }

  const max = Math.max(leftPrice, rightPrice, 1)
  const delta = Math.abs(leftPrice - rightPrice)
  return roundScore(1 - delta / max)
}

function scorePriceToProfile(
  averagePrice: number | undefined,
  candidate: CatalogProduct
): number {
  const candidatePrice = getPrimaryPrice(candidate.variants[0] ?? null)?.amountCents
  if (typeof averagePrice !== "number" || typeof candidatePrice !== "number") {
    return 0
  }

  const max = Math.max(averagePrice, candidatePrice, 1)
  const delta = Math.abs(averagePrice - candidatePrice)
  return roundScore(1 - delta / max)
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000
}

function buildRelatedExplanation(input: {
  anchor: CatalogProduct
  candidate: CatalogProduct
  recommendation: RelatedProductRecommendation
  collaborativeScore: number
  contentScore: number
}): RecommendationExplanation {
  // Explanations are concise on purpose; UI surfaces only a short summary + a few reasons.
  const sharedCategories = input.candidate.categories
    .filter((category) =>
      input.anchor.categories.some((anchorCategory) => anchorCategory.id === category.id)
    )
    .map((category) => category.name)
    .slice(0, 2)
  const titleTokens = intersectTokens(
    tokenize(input.anchor.title),
    tokenize(input.candidate.title)
  ).slice(0, 2)

  const reasons = [
    `Behavioral overlap is strongest on ${formatEventType(input.recommendation.strongestEventType)} signals.`,
  ]

  if (sharedCategories.length > 0) {
    reasons.push(`Shares categories with ${input.anchor.title}: ${sharedCategories.join(", ")}.`)
  }
  if (
    input.anchor.brand &&
    input.candidate.brand &&
    input.anchor.brand === input.candidate.brand
  ) {
    reasons.push(`Same brand family: ${input.anchor.brand}.`)
  }
  if (titleTokens.length > 0) {
    reasons.push(`Similar product language: ${titleTokens.join(", ")}.`)
  }
  if (scorePriceSimilarity(input.anchor, input.candidate) >= 0.75) {
    reasons.push("Sits in a similar price range.")
  }

  const summaryParts = [
    `Recommended because shoppers who engaged with ${input.anchor.title} also interacted with this item.`,
  ]
  if (input.contentScore >= 0.45) {
    summaryParts.push("It also matches closely on catalog attributes.")
  }

  return {
    summary: summaryParts.join(" "),
    reasons: reasons.slice(0, 3),
  }
}

function buildPersonalizedExplanation(input: {
  seedProducts: CatalogProduct[]
  candidate: CatalogProduct
  recommendation: RelatedProductRecommendation
  collaborativeScore: number
  contentScore: number
}): RecommendationExplanation {
  // Re-score candidate against user seeds to provide human-readable "closest to" context.
  const relatedSeeds = input.seedProducts
    .map((seed) => ({
      product: seed,
      similarity: scoreContentSimilarity(seed, input.candidate),
    }))
    .filter((entry) => entry.similarity > 0.2)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 2)

  const reasons = [
    `Behavioral match comes from your history and similar shoppers/sessions, strongest on ${formatEventType(
      input.recommendation.strongestEventType
    )}.`,
  ]

  if (relatedSeeds.length > 0) {
    reasons.push(
      `Closest to products you engaged with: ${relatedSeeds
        .map((entry) => entry.product.title)
        .join(", ")}.`
    )
  }
  if (input.candidate.brand) {
    const matchingBrandSeed = input.seedProducts.find(
      (seed) => seed.brand && seed.brand === input.candidate.brand
    )
    if (matchingBrandSeed) {
      reasons.push(`Matches a brand you already engaged with: ${input.candidate.brand}.`)
    }
  }
  if (scorePriceToProfile(buildProfile(input.seedProducts).averagePrice, input.candidate) >= 0.75) {
    reasons.push("Fits your recent price range.")
  }

  const summary =
    relatedSeeds.length > 0
      ? `Recommended because it lines up with your activity on ${relatedSeeds
          .map((entry) => entry.product.title)
          .join(" and ")} and also appears in similar shopper behavior.`
      : "Recommended from your recent activity pattern and similar shopper behavior."

  return {
    summary,
    reasons: reasons.slice(0, 3),
  }
}

function formatEventType(eventType: RelatedProductRecommendation["strongestEventType"]): string {
  switch (eventType) {
    case "cart_add":
      return "cart add"
    case "wishlist_add":
      return "wishlist"
    default:
      return eventType
  }
}

function intersectTokens(left: string[], right: string[]): string[] {
  // Deduplicate overlap terms so explanations avoid repetitive wording.
  const rightSet = new Set(right)
  return Array.from(new Set(left.filter((token) => rightSet.has(token))))
}
