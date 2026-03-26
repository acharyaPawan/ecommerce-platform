from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ml_svc.schemas.churn import CustomerChurnInput, CustomerChurnRequest
from ml_svc.services.churn import score_customer, score_customer_churn


def test_score_customer_flags_high_risk_shallow_customer() -> None:
    customer = CustomerChurnInput(
        user_id="user_1",
        name="Avery",
        email="avery@example.com",
        confirmed_orders=1,
        lifetime_value_cents=4200,
        average_order_value_cents=4200,
        top_category_id="home",
        top_category_name="Home",
        top_category_share=1,
        recent_top_category_id="wellness",
        recent_top_category_name="Wellness",
        recent_top_category_share=1,
        category_drift_score=1,
        days_since_order=100,
        days_since_interaction=60,
        last_confirmed_order_at=datetime.now(timezone.utc) - timedelta(days=100),
        last_interaction_at=datetime.now(timezone.utc) - timedelta(days=60),
    )

    result = score_customer(customer)

    assert result.churn_band == "high"
    assert result.churn_score >= 70
    assert result.retention_priority == "p2"
    assert "win-back" in result.recommendation


def test_score_customer_keeps_engaged_repeat_customer_low_risk() -> None:
    customer = CustomerChurnInput(
        user_id="user_2",
        name="Jordan",
        email="jordan@example.com",
        confirmed_orders=5,
        lifetime_value_cents=85_000,
        average_order_value_cents=17_000,
        top_category_id="office",
        top_category_name="Office",
        top_category_share=0.4,
        recent_top_category_id="office",
        recent_top_category_name="Office",
        recent_top_category_share=0.45,
        category_drift_score=0.05,
        days_since_order=8,
        days_since_interaction=2,
        last_confirmed_order_at=datetime.now(timezone.utc) - timedelta(days=8),
        last_interaction_at=datetime.now(timezone.utc) - timedelta(days=2),
    )

    result = score_customer(customer)

    assert result.churn_band == "low"
    assert result.retention_priority == "p3"


def test_score_customer_churn_returns_batch_response() -> None:
    now = datetime.now(timezone.utc)
    response = score_customer_churn(
        CustomerChurnRequest(
          customers=[
              CustomerChurnInput(
                  user_id="user_1",
                  confirmed_orders=1,
                  lifetime_value_cents=4200,
                  average_order_value_cents=4200,
                  top_category_share=1,
                  recent_top_category_share=1,
                  category_drift_score=1,
                  days_since_order=100,
                  days_since_interaction=60,
                  last_confirmed_order_at=now - timedelta(days=100),
                  last_interaction_at=now - timedelta(days=60),
              )
          ]
        )
    )

    assert len(response.customers) == 1
