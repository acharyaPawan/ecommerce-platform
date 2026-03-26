from __future__ import annotations

from ml_svc.schemas.recommendation import ProductFeatures, RecommendationCandidate, RecommendationRerankRequest
from ml_svc.services.recommendation import rerank_recommendations


def test_related_rerank_prefers_anchor_similarity() -> None:
    response = rerank_recommendations(
        RecommendationRerankRequest(
            mode="related",
            anchor_product=ProductFeatures(
                product_id="anchor",
                title="Oak Desk Lamp",
                description="Warm wooden desk lighting",
                brand="North",
                category_ids=["lighting", "home"],
            ),
            candidates=[
                RecommendationCandidate(
                    product_id="cand_1",
                    behavior_score=8,
                    supporting_signals=4,
                    strongest_event_type="purchase",
                    product=ProductFeatures(
                        product_id="cand_1",
                        title="Oak Table Lamp",
                        description="Wooden lamp for home office",
                        brand="North",
                        category_ids=["lighting", "home"],
                    ),
                ),
                RecommendationCandidate(
                    product_id="cand_2",
                    behavior_score=8,
                    supporting_signals=4,
                    strongest_event_type="purchase",
                    product=ProductFeatures(
                        product_id="cand_2",
                        title="Steel Water Bottle",
                        description="Hydration for travel",
                        brand="Flow",
                        category_ids=["wellness"],
                    ),
                ),
            ],
        )
    )

    assert response.items[0].product_id == "cand_1"


def test_personal_rerank_prefers_seed_similarity() -> None:
    response = rerank_recommendations(
        RecommendationRerankRequest(
            mode="personal",
            seed_products=[
                ProductFeatures(
                    product_id="seed_1",
                    title="Wellness Tea Set",
                    description="Calming tea ritual set",
                    brand="Still",
                    category_ids=["wellness"],
                )
            ],
            candidates=[
                RecommendationCandidate(
                    product_id="cand_1",
                    behavior_score=4,
                    supporting_signals=2,
                    strongest_event_type="click",
                    product=ProductFeatures(
                        product_id="cand_1",
                        title="Calming Tea Mug",
                        description="Wellness mug for tea ritual",
                        brand="Still",
                        category_ids=["wellness"],
                    ),
                ),
                RecommendationCandidate(
                    product_id="cand_2",
                    behavior_score=4,
                    supporting_signals=2,
                    strongest_event_type="click",
                    product=ProductFeatures(
                        product_id="cand_2",
                        title="Desk Organizer",
                        description="Workspace storage",
                        brand="North",
                        category_ids=["office"],
                    ),
                ),
            ],
        )
    )

    assert response.items[0].product_id == "cand_1"
