from __future__ import annotations

from datetime import date, timedelta

from ml_svc.schemas.forecast import CategoryDemandHistory, DailyDemandPoint
from ml_svc.services.forecasting import forecast_category, prepare_dense_series


def build_history(units: list[float], *, start: date = date(2026, 1, 1)) -> CategoryDemandHistory:
    return CategoryDemandHistory(
        category_id="cat-home",
        category_name="Home",
        history=[
            DailyDemandPoint(date=start + timedelta(days=index), units=value)
            for index, value in enumerate(units)
        ],
    )


def test_prepare_dense_series_fills_missing_days() -> None:
    history = [
        DailyDemandPoint(date=date(2026, 1, 1), units=3),
        DailyDemandPoint(date=date(2026, 1, 3), units=5),
        DailyDemandPoint(date=date(2026, 1, 4), units=2),
    ]

    dense = prepare_dense_series(history)

    assert [point.isoformat() for point in dense.dates] == [
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-04",
    ]
    assert dense.units.tolist() == [3.0, 0.0, 5.0, 2.0]


def test_forecast_category_marks_rising_demand() -> None:
    history = build_history(
        [8, 9, 8, 10, 9, 11, 10, 12, 11, 12, 13, 12, 14, 13, 15, 14, 16, 15, 17, 16, 18, 17, 19, 18, 20, 19, 21, 20]
    )

    result = forecast_category(history=history, horizon_days=14, min_history_days=14)

    assert result.projected_units > 0
    assert result.demand_status == "rising"
    assert len(result.forecast) == 14
    assert result.planning_units >= result.projected_units


def test_forecast_category_uses_low_confidence_for_short_histories() -> None:
    history = build_history([5, 6, 5, 4, 6, 5, 4, 5, 6, 5])

    result = forecast_category(history=history, horizon_days=7, min_history_days=14)

    assert result.confidence == "low"
    assert len(result.forecast) == 7
