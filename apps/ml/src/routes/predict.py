"""Prediction endpoint."""
from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException

from src.config import settings
from src.logger import get_logger
from src.models.schemas import PredictRequest, PredictResponse

router = APIRouter(tags=["predict"])
logger = get_logger(__name__)

# Registry is injected at startup from main.py
_registry: Optional[object] = None  # ModelRegistry instance


def _demo_prediction(request: PredictRequest) -> PredictResponse:
    """Return a deterministic-looking but clearly marked demo prediction.

    Uses a seeded RNG derived from symbol+timeframe so values are stable
    across multiple calls with the same inputs.
    """
    seed_str = f"{request.symbol}:{request.timeframe}:{request.model_name}"
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2 ** 31)
    rng = np.random.default_rng(seed)
    raw = rng.dirichlet([2.0, 1.5, 2.0])  # (down, neutral, up) shaped distribution
    p_down, p_neutral, p_up = float(raw[0]), float(raw[1]), float(raw[2])
    confidence = float(np.clip(max(p_up, p_down) - p_neutral, 0.0, 1.0))
    return PredictResponse(
        symbol=request.symbol,
        timeframe=request.timeframe,
        timestamp=datetime.now(tz=timezone.utc),
        probability_up=round(p_up, 4),
        probability_down=round(p_down, 4),
        probability_neutral=round(p_neutral, 4),
        confidence=round(confidence, 4),
        expected_volatility=None,
        market_regime="DEMO",
        model_version="demo_v0",
        features_version=request.features_version,
        is_demo=True,
    )


@router.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest) -> PredictResponse:
    """Make a price-direction prediction using the active trained model.

    If no trained model is available:
    - DEMO_MODE=true  → return a demo prediction (``is_demo=True``).
    - DEMO_MODE=false → raise HTTP 503.
    """
    global _registry

    direction_model = None
    if _registry is not None:
        try:
            direction_model = _registry.get_active_model("direction")  # type: ignore[union-attr]
        except Exception as exc:
            logger.warning("Registry lookup failed", extra={"error": str(exc)})

    if direction_model is None:
        if settings.DEMO_MODE:
            logger.info("Returning demo prediction", extra={"symbol": request.symbol})
            return _demo_prediction(request)
        raise HTTPException(
            status_code=503,
            detail="No trained model is available.  Set DEMO_MODE=true or train a model first.",
        )

    try:
        result = direction_model.predict_single(request.features)
    except Exception as exc:
        logger.warning("Prediction failed", extra={"symbol": request.symbol, "error": str(exc)})
        raise HTTPException(status_code=422, detail=f"Prediction error: {exc}")

    # Attempt to get volatility and regime predictions
    expected_vol: Optional[float] = None
    market_regime = "UNKNOWN"

    if _registry is not None:
        vol_model = _registry.get_active_model("volatility")  # type: ignore[union-attr]
        if vol_model is not None:
            try:
                expected_vol = vol_model.predict_single(request.features)
            except Exception:
                pass

        regime_model = _registry.get_active_model("regime")  # type: ignore[union-attr]
        if regime_model is not None:
            try:
                market_regime = regime_model.predict_single(request.features)
            except Exception:
                pass

    return PredictResponse(
        symbol=request.symbol,
        timeframe=request.timeframe,
        timestamp=datetime.now(tz=timezone.utc),
        probability_up=round(result["probability_up"], 6),
        probability_down=round(result["probability_down"], 6),
        probability_neutral=round(result["probability_neutral"], 6),
        confidence=round(result["confidence"], 6),
        expected_volatility=expected_vol,
        market_regime=market_regime,
        model_version=getattr(direction_model, "version", "unknown"),
        features_version=request.features_version,
        is_demo=False,
    )
