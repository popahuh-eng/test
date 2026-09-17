"""XGBoost regressor for future realised volatility prediction."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

from src.logger import get_logger

logger = get_logger(__name__)


class VolatilityModel:
    """XGBoost regressor that predicts future realised volatility.

    Target is the annualised realised volatility over the next ``horizon``
    candles, as produced by ``LabelGenerator.generate_volatility_labels``.
    """

    VERSION_PREFIX = "volatility_v"

    def __init__(self, hyperparameters: Optional[Dict] = None) -> None:
        default_params: Dict = {
            "n_estimators": 200,
            "max_depth": 5,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 3,
            "gamma": 0.0,
            "reg_alpha": 0.05,
            "reg_lambda": 1.0,
            "random_state": 42,
            "n_jobs": -1,
            "eval_metric": "mae",
            "objective": "reg:squarederror",
        }
        if hyperparameters:
            default_params.update(hyperparameters)
        self.params = default_params
        self.model: Optional[XGBRegressor] = None
        self.scaler: StandardScaler = StandardScaler()
        self.feature_names: List[str] = []
        self.version: str = ""
        self.is_trained: bool = False

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
    ) -> Dict:
        """Train regressor with chronologically ordered data."""
        self.feature_names = list(X_train.columns)

        X_tr_s = self.scaler.fit_transform(X_train.values)
        X_vl_s = self.scaler.transform(X_val.values)
        X_te_s = self.scaler.transform(X_test.values)

        self.model = XGBRegressor(
            **self.params,
            early_stopping_rounds=20,
        )
        self.model.fit(
            X_tr_s,
            y_train.values,
            eval_set=[(X_vl_s, y_val.values)],
            verbose=False,
        )

        val_pred = self.model.predict(X_vl_s)
        test_pred = self.model.predict(X_te_s)

        val_metrics = self._compute_metrics(y_val.values, val_pred)
        test_metrics = self._compute_metrics(y_test.values, test_pred)

        self.is_trained = True
        logger.info("VolatilityModel trained", extra={"val_mae": val_metrics.get("mae")})
        return {"validation_metrics": val_metrics, "test_metrics": test_metrics}

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Return predicted volatility values (annualised, >0)."""
        if not self.is_trained or self.model is None:
            raise ValueError("Model is not trained.")
        X_aligned = self._align_features(X)
        X_scaled = self.scaler.transform(X_aligned.values)
        preds = self.model.predict(X_scaled)
        return np.clip(preds, 0.0, None)

    def predict_single(self, features: Dict[str, float]) -> float:
        """Predict volatility for a single feature vector."""
        X = pd.DataFrame([features])
        return float(self.predict(X)[0])

    # ------------------------------------------------------------------
    # Metrics
    # ------------------------------------------------------------------

    def _compute_metrics(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        mse = float(mean_squared_error(y_true, y_pred))
        return {
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "rmse": float(np.sqrt(mse)),
            "r2": float(r2_score(y_true, y_pred)),
        }

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, artifact_dir: str) -> str:
        if not self.is_trained or self.model is None:
            raise ValueError("Cannot save an untrained model.")
        os.makedirs(artifact_dir, exist_ok=True)

        joblib.dump(self.model, os.path.join(artifact_dir, f"model_{self.version}.pkl"))
        joblib.dump(self.scaler, os.path.join(artifact_dir, f"scaler_{self.version}.pkl"))
        meta = {
            "version": self.version,
            "feature_names": self.feature_names,
            "params": self.params,
            "saved_at": datetime.now(tz=timezone.utc).isoformat(),
            "model_type": "VolatilityModel",
        }
        with open(os.path.join(artifact_dir, f"metadata_{self.version}.json"), "w") as f:
            json.dump(meta, f, indent=2)
        return artifact_dir

    def load(self, artifact_dir: str, version: str) -> None:
        self.model = joblib.load(os.path.join(artifact_dir, f"model_{version}.pkl"))
        self.scaler = joblib.load(os.path.join(artifact_dir, f"scaler_{version}.pkl"))
        with open(os.path.join(artifact_dir, f"metadata_{version}.json")) as f:
            meta = json.load(f)
        self.feature_names = meta["feature_names"]
        self.version = version
        self.is_trained = True

    @staticmethod
    def get_next_version(artifact_dir: str, prefix: str) -> str:
        if not os.path.isdir(artifact_dir):
            return f"{prefix}1"
        existing: List[int] = []
        for fname in os.listdir(artifact_dir):
            if fname.startswith(f"model_{prefix}") and fname.endswith(".pkl"):
                num_str = fname[len(f"model_{prefix}"):-4]
                if num_str.isdigit():
                    existing.append(int(num_str))
        return f"{prefix}{max(existing, default=0) + 1}"

    def _align_features(self, X: pd.DataFrame) -> pd.DataFrame:
        missing = set(self.feature_names) - set(X.columns)
        if missing:
            raise ValueError(f"Missing feature columns: {missing}")
        return X[self.feature_names]
