from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from ml_svc.schemas.churn import (
    CustomerChurnInput,
    CustomerChurnRequest,
    CustomerChurnResponse,
    CustomerChurnResult,
)

ValueBand = Literal["high", "medium", "low"]
DriftBand = Literal["high", "medium", "low"]
ChurnBand = Literal["high", "medium", "low"]
RetentionPriority = Literal["p1", "p2", "p3"]


def score_customer_churn(request: CustomerChurnRequest) -> CustomerChurnResponse:
    customers = [score_customer(customer) for customer in request.customers]
    return CustomerChurnResponse(
        generated_at=datetime.now(timezone.utc),
        customers=customers,
    )


def score_customer(customer: CustomerChurnInput) -> CustomerChurnResult:
    churn_score = 0
    drivers: list[str] = []

    if customer.days_since_order >= 90:
        churn_score += 55
        drivers.append("No confirmed order in the last 90 days.")
    elif customer.days_since_order >= 60:
        churn_score += 40
        drivers.append("Order recency has drifted beyond 60 days.")
    elif customer.days_since_order >= 30:
        churn_score += 20
        drivers.append("Order recency is starting to soften.")

    if customer.days_since_interaction is None:
        churn_score += 20
        drivers.append("No post-purchase interaction history is available.")
    elif customer.days_since_interaction >= 45:
        churn_score += 25
        drivers.append("No storefront activity in the last 45 days.")
    elif customer.days_since_interaction >= 21:
        churn_score += 15
        drivers.append("Customer engagement is cooling off.")

    if customer.confirmed_orders <= 1:
        churn_score += 15
        drivers.append("Customer has only one confirmed order so far.")
    elif customer.confirmed_orders <= 2:
        churn_score += 8
        drivers.append("Customer still has a shallow order history.")

    value_band = classify_value_band(customer.average_order_value_cents)
    if value_band == "low":
        churn_score += 10
        drivers.append("Customer value is still shallow relative to repeat buyers.")
    elif value_band == "high":
        churn_score = max(churn_score - 8, 0)

    if customer.top_category_share >= 0.75 and customer.confirmed_orders >= 2:
        churn_score += 8
        drivers.append("Purchase history is concentrated in a single category.")

    category_drift_band = classify_category_drift_band(customer.category_drift_score)
    if category_drift_band == "high":
        churn_score += 12
        drivers.append("Recent category behavior has drifted sharply from long-term preference.")
    elif category_drift_band == "medium":
        churn_score += 6
        drivers.append("Recent category mix is shifting away from the usual purchase pattern.")

    churn_score = min(churn_score, 100)
    churn_band = classify_churn_band(churn_score)
    retention_priority = resolve_retention_priority(churn_band, value_band, category_drift_band)
    recommendation = build_recommendation(churn_band)

    return CustomerChurnResult(
        user_id=customer.user_id,
        name=customer.name,
        email=customer.email,
        confirmed_orders=customer.confirmed_orders,
        lifetime_value_cents=customer.lifetime_value_cents,
        average_order_value_cents=customer.average_order_value_cents,
        value_band=value_band,
        top_category_id=customer.top_category_id,
        top_category_name=customer.top_category_name,
        top_category_share=customer.top_category_share,
        recent_top_category_id=customer.recent_top_category_id,
        recent_top_category_name=customer.recent_top_category_name,
        recent_top_category_share=customer.recent_top_category_share,
        category_drift_score=customer.category_drift_score,
        category_drift_band=category_drift_band,
        retention_priority=retention_priority,
        last_confirmed_order_at=customer.last_confirmed_order_at,
        last_interaction_at=customer.last_interaction_at,
        days_since_order=customer.days_since_order,
        days_since_interaction=customer.days_since_interaction,
        churn_score=churn_score,
        churn_band=churn_band,
        drivers=drivers[:3],
        recommendation=recommendation,
    )


def classify_value_band(average_order_value_cents: int) -> ValueBand:
    if average_order_value_cents >= 12_000:
        return "high"
    if average_order_value_cents >= 5_000:
        return "medium"
    return "low"


def classify_category_drift_band(score: float) -> DriftBand:
    if score >= 0.7:
        return "high"
    if score >= 0.35:
        return "medium"
    return "low"


def classify_churn_band(score: int) -> ChurnBand:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def resolve_retention_priority(
    churn_band: ChurnBand,
    value_band: ValueBand,
    category_drift_band: DriftBand,
) -> RetentionPriority:
    if churn_band == "high" and value_band == "high":
        return "p1"
    if churn_band == "high" or (churn_band == "medium" and value_band != "low") or category_drift_band == "high":
        return "p2"
    return "p3"


def build_recommendation(churn_band: ChurnBand) -> str:
    if churn_band == "high":
        return "Prioritize a win-back touchpoint or retention offer."
    if churn_band == "medium":
        return "Monitor closely and consider a light re-engagement message."
    return "Customer looks healthy. No immediate retention action needed."
