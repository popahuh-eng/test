"""Model registry – manages model versions and active model instances."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.logger import get_logger

logger = get_logger(__name__)


class ModelRegistry:
    """Manages model versions stored in PostgreSQL and caches loaded instances.

    The ``model_versions`` table is expected to have the following schema
    (created externally by the backend migration):

        CREATE TABLE IF NOT EXISTS model_versions (
            id              SERIAL PRIMARY KEY,
            model_name      VARCHAR(64)  NOT NULL,
            version         VARCHAR(64)  NOT NULL,
            artifact_path   TEXT         NOT NULL,
            features_version VARCHAR(16) NOT NULL,
            training_start  TIMESTAMPTZ  NOT NULL,
            training_end    TIMESTAMPTZ  NOT NULL,
            validation_metrics JSONB     NOT NULL DEFAULT '{}',
            test_metrics    JSONB        NOT NULL DEFAULT '{}',
            hyperparameters JSONB        NOT NULL DEFAULT '{}',
            is_active       BOOLEAN      NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
    """

    def __init__(self, artifact_dir: str, db_pool: Any) -> None:
        self.artifact_dir = artifact_dir
        self.db = db_pool  # expects the module-level db helpers from src.db
        self._loaded_models: Dict[str, Any] = {}  # model_name -> model instance

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(
        self,
        model_name: str,
        version: str,
        artifact_path: str,
        features_version: str,
        training_start: datetime,
        training_end: datetime,
        validation_metrics: Dict,
        test_metrics: Dict,
        hyperparameters: Dict,
    ) -> str:
        """Insert a new model version record.  Returns the version string."""
        sql = """
            INSERT INTO model_versions
                (model_name, version, artifact_path, features_version,
                 training_start, training_end, validation_metrics,
                 test_metrics, hyperparameters, is_active, created_at)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, FALSE, NOW())
        """
        self.db.execute_query(
            sql,
            (
                model_name,
                version,
                artifact_path,
                features_version,
                training_start,
                training_end,
                json.dumps(validation_metrics),
                json.dumps(test_metrics),
                json.dumps(hyperparameters),
            ),
        )
        logger.info("Model registered", extra={"model_name": model_name, "version": version})
        return version

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def get_active_model(self, model_name: str) -> Optional[Any]:
        """Return the cached active model instance, or None if not loaded."""
        return self._loaded_models.get(model_name)

    def set_active(self, model_name: str, version: str) -> None:
        """Mark a specific version as active in the DB and load it into memory."""
        # Deactivate all versions for this model name
        self.db.execute_query(
            "UPDATE model_versions SET is_active = FALSE WHERE model_name = %s",
            (model_name,),
        )
        # Activate the requested version
        self.db.execute_query(
            "UPDATE model_versions SET is_active = TRUE WHERE model_name = %s AND version = %s",
            (model_name, version),
        )
        # Load into cache
        model = self.load_model(model_name, version)
        self._loaded_models[model_name] = model
        logger.info("Active model updated", extra={"model_name": model_name, "version": version})

    def list_models(self) -> List[Dict]:
        """Return all registered model version records."""
        rows = self.db.fetch_many(
            """
            SELECT model_name, version, features_version,
                   training_start, training_end,
                   validation_metrics, test_metrics, is_active, created_at
            FROM model_versions
            ORDER BY created_at DESC
            """
        )
        return [dict(r) for r in (rows or [])]

    def load_model(self, model_name: str, version: str) -> Any:
        """Load a model from disk artifacts and cache it.

        Determines model type from metadata JSON file.
        """
        row = self.db.fetch_one(
            "SELECT artifact_path FROM model_versions WHERE model_name = %s AND version = %s",
            (model_name, version),
        )
        if not row:
            raise ValueError(f"Model {model_name} version {version} not found in registry.")

        artifact_path: str = row["artifact_path"]
        meta_path = os.path.join(artifact_path, f"metadata_{version}.json")
        if not os.path.exists(meta_path):
            raise FileNotFoundError(f"Metadata not found: {meta_path}")

        with open(meta_path) as f:
            meta = json.load(f)
        model_type = meta.get("model_type", "DirectionModel")

        if model_type == "DirectionModel":
            from src.models.direction_model import DirectionModel
            m = DirectionModel()
        elif model_type == "VolatilityModel":
            from src.models.volatility_model import VolatilityModel
            m = VolatilityModel()
        elif model_type == "RegimeModel":
            from src.models.regime_model import RegimeModel
            m = RegimeModel()
        else:
            raise ValueError(f"Unknown model_type: {model_type}")

        m.load(artifact_path, version)
        self._loaded_models[model_name] = m
        logger.info("Model loaded into cache", extra={"model_name": model_name, "version": version})
        return m

    def load_all_active(self) -> None:
        """Load all currently active models into the in-memory cache."""
        rows = self.db.fetch_many(
            "SELECT model_name, version, artifact_path FROM model_versions WHERE is_active = TRUE"
        )
        for row in (rows or []):
            try:
                self.load_model(row["model_name"], row["version"])
            except Exception as exc:
                logger.warning(
                    "Failed to load active model",
                    extra={"model_name": row["model_name"], "version": row["version"], "error": str(exc)},
                )
