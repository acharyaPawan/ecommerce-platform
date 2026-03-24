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
