"""FastAPI application entry point for the Trading Signal ML Service."""
from __future__ import annotations

import contextlib
import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.logger import get_logger
from src.routes import health, models_route, predict, train

logger = get_logger(__name__)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan – run startup / shutdown logic."""
    # ---- Startup ----
    logger.info("ML Service starting", extra={"port": settings.ML_SERVICE_PORT, "demo": settings.DEMO_MODE})

    # Ensure artifact directory exists
    os.makedirs(settings.MODEL_ARTIFACTS_DIR, exist_ok=True)

    # Try to load active models from the registry (non-fatal if DB is unavailable)
    try:
        from src import db as db_module
        from src.models.model_registry import ModelRegistry

        registry = ModelRegistry(artifact_dir=settings.MODEL_ARTIFACTS_DIR, db_pool=db_module)
        registry.load_all_active()

        # Inject registry into route modules
        predict._registry = registry
        models_route._registry = registry
        logger.info("Model registry initialised", extra={"loaded": len(registry._loaded_models)})
    except Exception as exc:
        logger.warning(
            "Could not initialise model registry (DB may be offline)",
            extra={"error": str(exc)},
        )

    yield  # Application is running

    # ---- Shutdown ----
    logger.info("ML Service shutting down")
    try:
        from src.db import close_pool
        close_pool()
    except Exception:
        pass


app = FastAPI(
    title="Trading Signal ML Service",
    version="1.0.0",
    description="Machine learning service for the Trading Signal Platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(predict.router)
app.include_router(train.router)
app.include_router(models_route.router)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.ML_SERVICE_PORT,
        reload=False,
        log_level=settings.LOG_LEVEL.lower(),
    )
