from __future__ import annotations

from collections import Counter

from ml_svc.schemas.recommendation import (
    ProductFeatures,
    RecommendationCandidate,
    RecommendationMode,
    RecommendationRerankRequest,
    RecommendationRerankResponse,
    RecommendationRerankResult,
)


def rerank_recommendations(request: RecommendationRerankRequest) -> RecommendationRerankResponse:
    behavior_scores = normalize_behavior_scores(request.candidates)
    items = [
        rerank_candidate(
            mode=request.mode,
            anchor_product=request.anchor_product,
            seed_products=request.seed_products,
            candidate=candidate,
            normalized_behavior_score=behavior_scores[candidate.product_id],
        )
        for candidate in request.candidates
    ]
    items.sort(key=lambda item: item.final_score, reverse=True)
    return RecommendationRerankResponse(items=items)


def rerank_candidate(
    *,
    mode: RecommendationMode,
    anchor_product: ProductFeatures | None,
    seed_products: list[ProductFeatures],
    candidate: RecommendationCandidate,
    normalized_behavior_score: float,
) -> RecommendationRerankResult:
    if mode == "related" and anchor_product is not None:
      content_score = score_related_content(anchor_product, candidate.product)
      final_score = normalized_behavior_score * 0.7 + content_score * 0.3
      summary, reasons = build_related_explanation(anchor_product, candidate.product, candidate.strongest_event_type)
    else:
      content_score = score_personal_content(seed_products, candidate.product)
      final_score = normalized_behavior_score * 0.75 + content_score * 0.25
      summary, reasons = build_personal_explanation(seed_products, candidate.product, candidate.strongest_event_type)

    return RecommendationRerankResult(
        product_id=candidate.product_id,
        final_score=round_score(final_score),
        behavior_score=round_score(normalized_behavior_score),
        content_score=round_score(content_score),
        summary=summary,
        reasons=reasons,
    )


def normalize_behavior_scores(candidates: list[RecommendationCandidate]) -> dict[str, float]:
    raw_scores = [candidate.behavior_score for candidate in candidates]
    if not raw_scores:
        return {}
    min_score = min(raw_scores)
    max_score = max(raw_scores)
    score_range = max(max_score - min_score, 1)
    return {
        candidate.product_id: (candidate.behavior_score - min_score) / score_range
        for candidate in candidates
    }


def score_related_content(anchor: ProductFeatures, candidate: ProductFeatures) -> float:
    category_score = overlap_ratio(anchor.category_ids, candidate.category_ids)
    brand_score = 1.0 if anchor.brand and candidate.brand and anchor.brand == candidate.brand else 0.0
    title_score = overlap_ratio(tokenize(anchor.title), tokenize(candidate.title))
    description_score = overlap_ratio(tokenize(anchor.description or ""), tokenize(candidate.description or ""))
    return (
        category_score * 0.4
        + brand_score * 0.2
        + title_score * 0.25
        + description_score * 0.15
    )


def score_personal_content(seed_products: list[ProductFeatures], candidate: ProductFeatures) -> float:
    if not seed_products:
        return 0.0

    category_counts: Counter[str] = Counter()
    brand_counts: Counter[str] = Counter()
    token_counts: Counter[str] = Counter()

    for product in seed_products:
        category_counts.update(product.category_ids)
        if product.brand:
            brand_counts.update([product.brand])
        token_counts.update(tokenize(product.title))
        token_counts.update(tokenize(product.description or ""))

    category_score = weighted_membership(category_counts, candidate.category_ids)
    brand_score = weighted_membership(brand_counts, [candidate.brand] if candidate.brand else [])
    token_score = weighted_membership(
        token_counts,
        tokenize(candidate.title) + tokenize(candidate.description or ""),
    )
    return category_score * 0.45 + brand_score * 0.2 + token_score * 0.35


def build_related_explanation(
    anchor: ProductFeatures,
    candidate: ProductFeatures,
    strongest_event_type: str,
) -> tuple[str, list[str]]:
    reasons: list[str] = [f"Behavioral lead signal is {strongest_event_type}."]
    if overlap_ratio(anchor.category_ids, candidate.category_ids) > 0:
        reasons.append("Shares category context with the anchor product.")
    if anchor.brand and candidate.brand and anchor.brand == candidate.brand:
        reasons.append("Matches the anchor product's brand.")
    if overlap_ratio(tokenize(anchor.title), tokenize(candidate.title)) > 0:
        reasons.append("Product titles overlap on key terms.")

    return (
        "Re-ranked using live behavior plus product similarity to the current item.",
        reasons[:3],
    )


def build_personal_explanation(
    seed_products: list[ProductFeatures],
    candidate: ProductFeatures,
    strongest_event_type: str,
) -> tuple[str, list[str]]:
    reasons: list[str] = [f"Behavioral lead signal is {strongest_event_type}."]
    seed_categories = {category for product in seed_products for category in product.category_ids}
    if seed_categories.intersection(candidate.category_ids):
        reasons.append("Matches categories from the strongest recent seed products.")

    seed_brands = {product.brand for product in seed_products if product.brand}
    if candidate.brand and candidate.brand in seed_brands:
        reasons.append("Matches a brand seen in recent preference signals.")

    seed_tokens = {
        token for product in seed_products for token in tokenize(product.title) + tokenize(product.description or "")
    }
    if seed_tokens.intersection(tokenize(candidate.title) + tokenize(candidate.description or "")):
        reasons.append("Shares descriptive terms with recent preference seeds.")

    return (
        "Re-ranked using behavior plus similarity to your strongest recent products.",
        reasons[:3],
    )


def weighted_membership(weights: Counter[str], values: list[str]) -> float:
    if not weights or not values:
        return 0.0
    total_weight = sum(weights.values()) or 1
    matched_weight = sum(weights.get(value, 0) for value in values)
    return min(matched_weight / total_weight, 1.0)


def overlap_ratio(left: list[str], right: list[str]) -> float:
    if not left or not right:
        return 0.0
    left_set = set(left)
    right_set = set(right)
    overlap = len(left_set.intersection(right_set))
    return overlap / max(len(left_set), len(right_set), 1)


def tokenize(text: str) -> list[str]:
    return [token for token in "".join(char.lower() if char.isalnum() else " " for char in text).split() if len(token) >= 3]


def round_score(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 3)
