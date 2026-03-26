from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


RecommendationMode = Literal["related", "personal"]


class ProductFeatures(BaseModel):
    product_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str | None = None
    brand: str | None = None
    category_ids: list[str] = Field(default_factory=list)


class RecommendationCandidate(BaseModel):
    product_id: str = Field(min_length=1)
    behavior_score: float = Field(ge=0)
    supporting_signals: int = Field(ge=0)
    strongest_event_type: str = Field(min_length=1)
    product: ProductFeatures


class RecommendationRerankRequest(BaseModel):
    mode: RecommendationMode
    anchor_product: ProductFeatures | None = None
    seed_products: list[ProductFeatures] = Field(default_factory=list)
    candidates: list[RecommendationCandidate] = Field(min_length=1, max_length=100)


class RecommendationRerankResult(BaseModel):
    product_id: str
    final_score: float = Field(ge=0)
    behavior_score: float = Field(ge=0)
    content_score: float = Field(ge=0)
    summary: str
    reasons: list[str]


class RecommendationRerankResponse(BaseModel):
    items: list[RecommendationRerankResult]
