from __future__ import annotations

from fastapi import APIRouter

from ml_svc.schemas.churn import CustomerChurnRequest, CustomerChurnResponse
from ml_svc.services.churn import score_customer_churn

router = APIRouter(prefix="/churn", tags=["churn"])


@router.post("/customers", response_model=CustomerChurnResponse)
def score_customers(request: CustomerChurnRequest) -> CustomerChurnResponse:
    return score_customer_churn(request)
