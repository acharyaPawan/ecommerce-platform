from __future__ import annotations

from fastapi import APIRouter

from ml_svc.schemas.recommendation import RecommendationRerankRequest, RecommendationRerankResponse
from ml_svc.services.recommendation import rerank_recommendations

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("/rerank", response_model=RecommendationRerankResponse)
def rerank(request: RecommendationRerankRequest) -> RecommendationRerankResponse:
    return rerank_recommendations(request)
