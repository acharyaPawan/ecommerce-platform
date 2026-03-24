from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from math import ceil, pi
from typing import Literal

import numpy as np

from ml_svc.schemas.forecast import (
    CategoryDemandHistory,
    CategoryForecastRequest,
    CategoryForecastResponse,
    CategoryForecastResult,
    DailyDemandPoint,
    ForecastPoint,
)

Confidence = Literal["high", "medium", "low"]
DemandStatus = Literal["rising", "stable", "softening"]
RiskLevel = Literal["high", "medium", "low"]
Urgency = Literal["urgent", "watch", "stable"]


@dataclass(slots=True)
class PreparedSeries:
    dates: list[date]
    units: np.ndarray


def generate_category_forecast(
    request: CategoryForecastRequest,
) -> CategoryForecastResponse:
    categories = [
        forecast_category(history=category, horizon_days=request.horizon_days, min_history_days=request.min_history_days)
        for category in request.categories
    ]

    return CategoryForecastResponse(
        generated_at=datetime.now(timezone.utc),
        horizon_days=request.horizon_days,
        categories=categories,
    )


def forecast_category(
    *,
    history: CategoryDemandHistory,
    horizon_days: int,
    min_history_days: int,
) -> CategoryForecastResult:
    prepared = prepare_dense_series(history.history)
    observed = prepared.units
    observed_dates = prepared.dates

    if observed.size < min_history_days:
        forecast_values = repeat_recent_average(observed, horizon_days)
        confidence: Confidence = "low"
    else:
        forecast_values = fit_trend_seasonality_forecast(observed, horizon_days)
        confidence = estimate_confidence(observed, horizon_days)

    recent_window_units, previous_window_units = split_recent_vs_previous(observed)
    trend_pct = calculate_trend_pct(recent_window_units, previous_window_units)
    demand_status = classify_demand_status(trend_pct)
    risk_level = classify_risk_level(confidence, demand_status, forecast_values, observed)
    urgency = classify_urgency(risk_level, demand_status)
    projected_units = round(float(np.sum(forecast_values)), 2)
    safety_buffer_units = round(projected_units * safety_buffer_ratio(confidence, risk_level), 2)
    planning_units = round(projected_units + safety_buffer_units, 2)

    history_points = [
        ForecastPoint(date=point_date, units=round(float(point_units), 2))
        for point_date, point_units in zip(observed_dates, observed, strict=True)
    ]
    forecast_points = [
        ForecastPoint(date=observed_dates[-1] + timedelta(days=index + 1), units=round(float(value), 2))
        for index, value in enumerate(forecast_values)
    ]

    return CategoryForecastResult(
        category_id=history.category_id,
        category_name=history.category_name,
        total_observed_units=round(float(np.sum(observed)), 2),
        avg_daily_units=round(float(np.mean(observed)), 2),
        recent_window_units=round(recent_window_units, 2),
        previous_window_units=round(previous_window_units, 2),
        trend_pct=round(trend_pct, 2),
        projected_units=projected_units,
        confidence=confidence,
        demand_status=demand_status,
        risk_level=risk_level,
        urgency=urgency,
        safety_buffer_units=safety_buffer_units,
        planning_units=planning_units,
        narrative=build_narrative(
            category_name=history.category_name,
            demand_status=demand_status,
            risk_level=risk_level,
            confidence=confidence,
            projected_units=projected_units,
            planning_units=planning_units,
            safety_buffer_units=safety_buffer_units,
        ),
        history=history_points,
        forecast=forecast_points,
    )


def prepare_dense_series(history: list[DailyDemandPoint]) -> PreparedSeries:
    sorted_points = sorted(history, key=lambda point: point.date)
    start = sorted_points[0].date
    end = sorted_points[-1].date
    raw_by_date = {point.date: point.units for point in sorted_points}

    dense_dates: list[date] = []
    dense_units: list[float] = []
    current = start

    while current <= end:
        dense_dates.append(current)
        dense_units.append(raw_by_date.get(current, 0.0))
        current += timedelta(days=1)

    return PreparedSeries(dates=dense_dates, units=np.array(dense_units, dtype=float))


def fit_trend_seasonality_forecast(units: np.ndarray, horizon_days: int) -> np.ndarray:
    """
    Fit a small regression model using:
    - a linear trend over time
    - weekly seasonality via sine/cosine terms

    This is intentionally simple for v1:
    it is explainable, fast, and stable enough to establish the Python service boundary
    before we move to heavier forecasting libraries or trained pipelines.
    """

    history_length = units.size
    t = np.arange(history_length, dtype=float)
    design = np.column_stack(
        [
            np.ones(history_length, dtype=float),
            t,
            np.sin(2 * pi * t / 7),
            np.cos(2 * pi * t / 7),
        ]
    )
    coefficients, *_ = np.linalg.lstsq(design, units, rcond=None)

    future_t = np.arange(history_length, history_length + horizon_days, dtype=float)
    future_design = np.column_stack(
        [
            np.ones(horizon_days, dtype=float),
            future_t,
            np.sin(2 * pi * future_t / 7),
            np.cos(2 * pi * future_t / 7),
        ]
    )
    forecast = future_design @ coefficients
    return np.maximum(forecast, 0.0)


def repeat_recent_average(units: np.ndarray, horizon_days: int) -> np.ndarray:
    window = units[-min(7, units.size) :]
    baseline = float(np.mean(window)) if window.size else 0.0
    return np.full(horizon_days, baseline, dtype=float)


def split_recent_vs_previous(units: np.ndarray) -> tuple[float, float]:
    window = min(14, max(7, units.size // 2))
    recent = float(np.sum(units[-window:]))
    previous_slice = units[-(window * 2) : -window]
    previous = float(np.sum(previous_slice)) if previous_slice.size else 0.0
    return recent, previous


def calculate_trend_pct(recent_window_units: float, previous_window_units: float) -> float:
    if previous_window_units <= 0:
        if recent_window_units <= 0:
            return 0.0
        return 100.0
    return ((recent_window_units - previous_window_units) / previous_window_units) * 100


def estimate_confidence(units: np.ndarray, horizon_days: int) -> Confidence:
    if units.size < 21:
        return "low"

    holdout = min(14, max(7, units.size // 4))
    train = units[:-holdout]
    actual = units[-holdout:]
    if train.size < 7:
        return "low"

    predicted = fit_trend_seasonality_forecast(train, holdout)
    denominator = max(float(np.sum(actual)), 1.0)
    wmape = float(np.sum(np.abs(actual - predicted)) / denominator)

    if train.size >= 56 and wmape <= 0.25 and horizon_days <= 21:
        return "high"
    if train.size >= 28 and wmape <= 0.5:
        return "medium"
    return "low"


def classify_demand_status(trend_pct: float) -> DemandStatus:
    if trend_pct >= 12:
        return "rising"
    if trend_pct <= -12:
        return "softening"
    return "stable"


def classify_risk_level(
    confidence: Confidence,
    demand_status: DemandStatus,
    forecast_values: np.ndarray,
    observed: np.ndarray,
) -> RiskLevel:
    projected_daily_average = float(np.mean(forecast_values)) if forecast_values.size else 0.0
    observed_daily_average = float(np.mean(observed)) if observed.size else 0.0
    acceleration = projected_daily_average - observed_daily_average

    if demand_status == "rising" and (confidence == "low" or acceleration > observed_daily_average * 0.2):
        return "high"
    if demand_status == "softening" and confidence == "high":
        return "low"
    if confidence == "low":
        return "high"
    if demand_status == "stable" and confidence == "high":
        return "low"
    return "medium"


def classify_urgency(risk_level: RiskLevel, demand_status: DemandStatus) -> Urgency:
    if risk_level == "high" and demand_status == "rising":
        return "urgent"
    if risk_level == "high" or demand_status != "stable":
        return "watch"
    return "stable"


def safety_buffer_ratio(confidence: Confidence, risk_level: RiskLevel) -> float:
    if risk_level == "high":
        return 0.3 if confidence == "low" else 0.22
    if risk_level == "medium":
        return 0.18 if confidence == "low" else 0.12
    return 0.08


def build_narrative(
    *,
    category_name: str,
    demand_status: DemandStatus,
    risk_level: RiskLevel,
    confidence: Confidence,
    projected_units: float,
    planning_units: float,
    safety_buffer_units: float,
) -> str:
    status_phrase = {
        "rising": "Demand is climbing",
        "stable": "Demand looks stable",
        "softening": "Demand is easing",
    }[demand_status]
    risk_phrase = {
        "high": "treat this as a higher-risk planning category",
        "medium": "keep this category under review",
        "low": "planning risk is currently limited",
    }[risk_level]

    return (
        f"{status_phrase} for {category_name}. "
        f"Project about {ceil(projected_units)} units over the next horizon, "
        f"plan for roughly {ceil(planning_units)} including a {ceil(safety_buffer_units)}-unit safety buffer, "
        f"and {risk_phrase}. Model confidence is {confidence}."
    )
