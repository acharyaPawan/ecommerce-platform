import type { CatalogProduct } from "@/lib/types/catalog"
import type { RelatedProductRecommendation } from "@/lib/types/analytics"
import { getPrimaryPrice } from "@/lib/utils/catalog"

type RankedRecommendation = RelatedProductRecommendation & {
  hybridScore: number
  contentScore: number
  collaborativeScore: number
}

export function rerankRelatedHybrid(
  anchor: CatalogProduct,
  candidates: CatalogProduct[],
  recommendations: RelatedProductRecommendation[]
): RankedRecommendation[] {
  const collaborativeScores = normalizeRecommendationScores(recommendations)

  return candidates
    .map((candidate) => {
      const recommendation = recommendations.find((item) => item.productId === candidate.id)
      if (!recommendation) {
        return null
      }

      const collaborativeScore = collaborativeScores.get(candidate.id) ?? 0
      const contentScore = scoreContentSimilarity(anchor, candidate)
      const hybridScore = collaborativeScore * 0.7 + contentScore * 0.3

      return {
        ...recommendation,
        collaborativeScore,
        contentScore,
        hybridScore,
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
  const profile = buildProfile(seedProducts)

  return candidates
    .map((candidate) => {
      const recommendation = recommendations.find((item) => item.productId === candidate.id)
      if (!recommendation) {
        return null
      }

      const collaborativeScore = collaborativeScores.get(candidate.id) ?? 0
      const contentScore = scoreProfileSimilarity(profile, candidate)
      const hybridScore = collaborativeScore * 0.75 + contentScore * 0.25

      return {
        ...recommendation,
        collaborativeScore,
        contentScore,
        hybridScore,
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
