from __future__ import annotations

from fastapi import FastAPI
import uvicorn

from ml_svc.api.churn import router as churn_router
from ml_svc.api.forecast import router as forecast_router
from ml_svc.config import load_settings

settings = load_settings()
app = FastAPI(title="ecommerce-ml-svc", version="0.1.0")


@app.get("/")
def root() -> dict[str, str]:
    return {"service": settings.service_name, "status": "ok"}


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "healthy"}


@app.get("/readyz")
def readyz() -> dict[str, str]:
    return {"status": "ready"}


app.include_router(forecast_router, prefix="/api")
app.include_router(churn_router, prefix="/api")


def main() -> None:
    uvicorn.run(
        "ml_svc.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
