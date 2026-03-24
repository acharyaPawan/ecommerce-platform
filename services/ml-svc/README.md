# ecommerce-ml-svc

Python ML service for model-backed forecasting and later recommendation/churn workloads.

## Run

```bash
uv sync --group dev
uv run uvicorn ml_svc.main:app --host 0.0.0.0 --port 8010
```

## Test

```bash
uv run --group dev pytest
```
