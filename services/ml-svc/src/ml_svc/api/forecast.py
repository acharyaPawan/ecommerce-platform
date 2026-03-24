from __future__ import annotations

from fastapi import APIRouter

from ml_svc.schemas.forecast import CategoryForecastRequest, CategoryForecastResponse
from ml_svc.services.forecasting import generate_category_forecast

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.post("/categories", response_model=CategoryForecastResponse)
def forecast_categories(request: CategoryForecastRequest) -> CategoryForecastResponse:
    return generate_category_forecast(request)
