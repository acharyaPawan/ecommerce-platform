from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class DailyDemandPoint(BaseModel):
    date: date
    units: float = Field(ge=0)


class CategoryDemandHistory(BaseModel):
    category_id: str = Field(min_length=1)
    category_name: str = Field(min_length=1)
    history: list[DailyDemandPoint] = Field(min_length=7)

    @field_validator("history")
    @classmethod
    def ensure_unique_dates(cls, history: list[DailyDemandPoint]) -> list[DailyDemandPoint]:
        dates = [point.date for point in history]
        if len(dates) != len(set(dates)):
            raise ValueError("history cannot contain duplicate dates")
        return history


class CategoryForecastRequest(BaseModel):
    horizon_days: int = Field(default=14, ge=1, le=90)
    min_history_days: int = Field(default=14, ge=7, le=180)
    categories: list[CategoryDemandHistory] = Field(min_length=1, max_length=100)


class ForecastPoint(BaseModel):
    date: date
    units: float = Field(ge=0)


class CategoryForecastResult(BaseModel):
    category_id: str
    category_name: str
    total_observed_units: float = Field(ge=0)
    avg_daily_units: float = Field(ge=0)
    recent_window_units: float = Field(ge=0)
    previous_window_units: float = Field(ge=0)
    trend_pct: float
    projected_units: float = Field(ge=0)
    confidence: Literal["high", "medium", "low"]
    demand_status: Literal["rising", "stable", "softening"]
    risk_level: Literal["high", "medium", "low"]
    urgency: Literal["urgent", "watch", "stable"]
    safety_buffer_units: float = Field(ge=0)
    planning_units: float = Field(ge=0)
    narrative: str
    history: list[ForecastPoint]
    forecast: list[ForecastPoint]


class CategoryForecastResponse(BaseModel):
    generated_at: datetime
    horizon_days: int
    categories: list[CategoryForecastResult]
