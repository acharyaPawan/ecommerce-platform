from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ValueBand = Literal["high", "medium", "low"]
DriftBand = Literal["high", "medium", "low"]
ChurnBand = Literal["high", "medium", "low"]
RetentionPriority = Literal["p1", "p2", "p3"]


class CustomerChurnInput(BaseModel):
    user_id: str = Field(min_length=1)
    name: str | None = None
    email: str | None = None
    confirmed_orders: int = Field(ge=0)
    lifetime_value_cents: int = Field(ge=0)
    average_order_value_cents: int = Field(ge=0)
    top_category_id: str | None = None
    top_category_name: str | None = None
    top_category_share: float = Field(ge=0, le=1)
    recent_top_category_id: str | None = None
    recent_top_category_name: str | None = None
    recent_top_category_share: float = Field(ge=0, le=1)
    category_drift_score: float = Field(ge=0, le=1)
    days_since_order: int = Field(ge=0)
    days_since_interaction: int | None = Field(default=None, ge=0)
    last_confirmed_order_at: datetime
    last_interaction_at: datetime | None = None


class CustomerChurnRequest(BaseModel):
    customers: list[CustomerChurnInput] = Field(min_length=1, max_length=500)


class CustomerChurnResult(BaseModel):
    user_id: str
    name: str | None
    email: str | None
    confirmed_orders: int
    lifetime_value_cents: int
    average_order_value_cents: int
    value_band: ValueBand
    top_category_id: str | None
    top_category_name: str | None
    top_category_share: float
    recent_top_category_id: str | None
    recent_top_category_name: str | None
    recent_top_category_share: float
    category_drift_score: float
    category_drift_band: DriftBand
    retention_priority: RetentionPriority
    last_confirmed_order_at: datetime
    last_interaction_at: datetime | None
    days_since_order: int
    days_since_interaction: int | None
    churn_score: int = Field(ge=0, le=100)
    churn_band: ChurnBand
    drivers: list[str]
    recommendation: str


class CustomerChurnResponse(BaseModel):
    generated_at: datetime
    customers: list[CustomerChurnResult]
