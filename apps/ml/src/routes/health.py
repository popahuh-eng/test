"""Health check endpoint."""
from __future__ import annotations

from datetime import datetime, timezone

import redis as redis_lib
from fastapi import APIRouter

from src.config import settings
from src.db import test_connection
from src.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return service health status including DB and Redis connectivity."""
    # Database check
    try:
        db_ok = test_connection()
        db_status = "healthy" if db_ok else "unhealthy"
    except Exception:
        db_status = "unhealthy"

    # Redis check
    try:
        r = redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        redis_status = "healthy"
    except Exception:
        redis_status = "unhealthy"

    # Count loaded models (imported lazily to avoid circular imports)
    models_loaded = 0
    try:
        from src.routes.predict import _registry  # type: ignore[import]
        if _registry is not None:
            models_loaded = len(_registry._loaded_models)
    except Exception:
        models_loaded = 0

    overall = "healthy" if db_status == "healthy" else "degraded"
    return HealthResponse(
        status=overall,
        database=db_status,
        redis=redis_status,
        models_loaded=models_loaded,
        timestamp=datetime.now(tz=timezone.utc),
    )
