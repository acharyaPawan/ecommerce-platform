from __future__ import annotations

from fastapi.testclient import TestClient

from ml_svc.main import app


client = TestClient(app)


def test_root_status() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_category_forecast_endpoint() -> None:
    response = client.post(
        "/api/forecast/categories",
        json={
            "horizon_days": 7,
            "categories": [
                {
                    "category_id": "cat-home",
                    "category_name": "Home",
                    "history": [
                        {"date": "2026-01-01", "units": 4},
                        {"date": "2026-01-02", "units": 5},
                        {"date": "2026-01-03", "units": 4},
                        {"date": "2026-01-04", "units": 6},
                        {"date": "2026-01-05", "units": 5},
                        {"date": "2026-01-06", "units": 7},
                        {"date": "2026-01-07", "units": 6},
                        {"date": "2026-01-08", "units": 8},
                        {"date": "2026-01-09", "units": 7},
                        {"date": "2026-01-10", "units": 9},
                        {"date": "2026-01-11", "units": 8},
                        {"date": "2026-01-12", "units": 10},
                        {"date": "2026-01-13", "units": 9},
                        {"date": "2026-01-14", "units": 11}
                    ],
                }
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["horizon_days"] == 7
    assert len(payload["categories"]) == 1
    assert len(payload["categories"][0]["forecast"]) == 7


def test_customer_churn_endpoint() -> None:
    response = client.post(
        "/api/churn/customers",
        json={
            "customers": [
                {
                    "user_id": "user_1",
                    "name": "Avery",
                    "email": "avery@example.com",
                    "confirmed_orders": 1,
                    "lifetime_value_cents": 4200,
                    "average_order_value_cents": 4200,
                    "top_category_id": "home",
                    "top_category_name": "Home",
                    "top_category_share": 1,
                    "recent_top_category_id": "wellness",
                    "recent_top_category_name": "Wellness",
                    "recent_top_category_share": 1,
                    "category_drift_score": 1,
                    "days_since_order": 100,
                    "days_since_interaction": 60,
                    "last_confirmed_order_at": "2025-12-16T00:00:00Z",
                    "last_interaction_at": "2026-01-25T00:00:00Z"
                }
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["customers"]) == 1
    assert payload["customers"][0]["churn_band"] == "high"


def test_recommendation_rerank_endpoint() -> None:
    response = client.post(
        "/api/recommendations/rerank",
        json={
            "mode": "related",
            "anchor_product": {
                "product_id": "anchor",
                "title": "Oak Desk Lamp",
                "description": "Warm wooden desk lighting",
                "brand": "North",
                "category_ids": ["lighting", "home"]
            },
            "candidates": [
                {
                    "product_id": "cand_1",
                    "behavior_score": 8,
                    "supporting_signals": 4,
                    "strongest_event_type": "purchase",
                    "product": {
                        "product_id": "cand_1",
                        "title": "Oak Table Lamp",
                        "description": "Wooden lamp for home office",
                        "brand": "North",
                        "category_ids": ["lighting", "home"]
                    }
                }
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 1
    assert payload["items"][0]["product_id"] == "cand_1"
