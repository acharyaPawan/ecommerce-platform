# Hybrid Recommendation Reranking (Frontend)

This document explains the hybrid reranking module used by the storefront app:

- Source: `apps/ecommerce-frontend/lib/recommendations/hybrid.ts`
- Purpose: blend collaborative recommendation strength with catalog/content similarity.

## Why hybrid reranking exists

Raw collaborative recommendations are strong for behavior signals but may miss product context.
The hybrid layer keeps collaborative ranking as primary signal and adds a content/profile correction so results are easier to explain and feel more relevant.

## Outputs

Both flows return `RankedRecommendation[]` with:

- `collaborativeScore` in normalized 0..1 range
- `contentScore` in 0..1 range
- `hybridScore` as weighted blend
- `explanation` with user-facing `summary` and `reasons`

## Flow 1: Related products reranking

`rerankRelatedHybrid(anchor, candidates, recommendations)`:

1. Normalize collaborative scores using min-max normalization.
2. For each candidate that exists in recommendations:
   - Compute collaborative score from normalized map.
   - Compute content similarity against anchor product.
   - Blend score using:
     - `hybridScore = collaborative * 0.7 + content * 0.3`
3. Build explanation text from shared category/brand/title/price signals.
4. Sort by `hybridScore` descending.

## Flow 2: Personalized reranking

`rerankPersonalizedHybrid(seedProducts, candidates, recommendations)`:

1. Normalize collaborative scores.
2. Build user profile from seed products:
   - category frequency map
   - brand frequency map
   - token frequency map (title + description)
   - average observed price
3. For each candidate present in recommendations:
   - score profile similarity
   - blend score using:
     - `hybridScore = collaborative * 0.75 + content * 0.25`
4. Build explanation text using closest seed items and supporting signals.
5. Sort by `hybridScore` descending.

## Scoring details

### Collaborative normalization

`normalizeRecommendationScores` applies min-max normalization:

`normalized = (score - min) / max(max - min, 1)`

This keeps order while aligning score scale with content scores.

### Content similarity (related flow)

`scoreContentSimilarity` uses weighted components:

- category overlap: `0.35`
- brand exact match: `0.20`
- title token overlap: `0.20`
- description token overlap: `0.10`
- price similarity: `0.15`

All values are clamped to `[0, 1]` and rounded to 3 decimals.

### Profile similarity (personalized flow)

`scoreProfileSimilarity` uses weighted components:

- weighted category membership: `0.40`
- weighted brand membership: `0.20`
- weighted token membership: `0.25`
- price-to-profile similarity: `0.15`

## Explainability behavior

Explanations are intentionally short.

- Summary: one sentence (or two short clauses) describing why item was selected.
- Reasons: at most 3 bullets worth of evidence (converted to strings).
- Event type labels are normalized to user-friendly text (for example `cart_add` -> `cart add`).

## Guardrails and edge handling

- Candidates not present in collaborative recommendation list are dropped.
- Missing brand/description/price data gracefully degrades score components to `0`.
- Empty lists/maps return `0` for overlap/membership utilities.
- All score helpers use the same clamping/rounding path via `roundScore`.

## Tuning guidance

If recommendation quality drifts, tune in this order:

1. Blend weights (`0.7/0.3` and `0.75/0.25`).
2. Feature component weights in content/profile scoring.
3. Tokenization thresholds and stop-word handling.
4. Explanation thresholds (for example minimum similarity required to mention price).

Keep total weights in each score function at `1.0` to preserve interpretability.
