from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(slots=True)
class Settings:
    service_name: str = "ml-svc"
    port: int = 8010


def load_settings() -> Settings:
    return Settings(
        service_name=os.getenv("ML_SERVICE_NAME", "ml-svc"),
        port=int(os.getenv("ML_SVC_PORT", os.getenv("PORT", "8010"))),
    )
