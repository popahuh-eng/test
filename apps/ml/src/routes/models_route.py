"""Model listing and management endpoints."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException

from src.logger import get_logger

router = APIRouter(tags=["models"])
logger = get_logger(__name__)

# Injected at startup from main.py
_registry: Optional[object] = None


@router.get("/models", response_model=List[dict])
async def list_models() -> List[dict]:
    """List all registered model versions."""
    if _registry is None:
        return []
    try:
        return _registry.list_models()  # type: ignore[union-attr]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Registry unavailable: {exc}")


@router.post("/models/{model_name}/{version}/activate")
async def activate_model(model_name: str, version: str) -> dict:
    """Set a specific model version as active."""
    if _registry is None:
        raise HTTPException(status_code=503, detail="Model registry not initialised")
    try:
        _registry.set_active(model_name, version)  # type: ignore[union-attr]
        return {"status": "activated", "model_name": model_name, "version": version}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
