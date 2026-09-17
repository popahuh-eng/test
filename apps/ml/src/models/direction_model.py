"""XGBoost direction classifier.

Classes: 0=DOWN, 1=NEUTRAL, 2=UP
Uses CalibratedClassifierCV for well-calibrated probability outputs.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
)
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from src.logger import get_logger

logger = get_logger(__name__)

# Class label mapping
_DOWN = 0
_NEUTRAL = 1
_UP = 2


class DirectionModel:
    """XGBoost classifier for price direction prediction.

    Maps direction labels {-1, 0, 1} -> XGB labels {0, 1, 2}.
    Outputs calibrated probabilities for UP, DOWN, NEUTRAL.
    """

    VERSION_PREFIX = "direction_v"

    def __init__(self, hyperparameters: Optional[Dict] = None) -> None:
        default_params: Dict = {
            "n_estimators": 300,
            "max_depth": 6,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 5,
            "gamma": 0.1,
            "reg_alpha": 0.1,
            "reg_lambda": 1.0,
            "random_state": 42,
            "n_jobs": -1,
            "eval_metric": "mlogloss",
        }
        if hyperparameters:
            default_params.update(hyperparameters)
        self.params = default_params
        self.model: Optional[CalibratedClassifierCV] = None
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
        """Train model with chronologically ordered data.

        Returns dict with ``validation_metrics`` and ``test_metrics``.
        """
        self.feature_names = list(X_train.columns)

        # Map direction labels (-1, 0, 1) -> XGB labels (0, 1, 2)
        def _map(y: pd.Series) -> np.ndarray:
            return (y + 1).astype(int).values

        y_tr = _map(y_train)
        y_vl = _map(y_val)
        y_te = _map(y_test)

        # Scale features
        X_tr_s = self.scaler.fit_transform(X_train.values)
        X_vl_s = self.scaler.transform(X_val.values)
        X_te_s = self.scaler.transform(X_test.values)

        # Base XGB with early stopping
        base_xgb = XGBClassifier(
            **self.params,
            num_class=3,
            objective="multi:softprob",
            early_stopping_rounds=30,
        )
        base_xgb.fit(
            X_tr_s,
            y_tr,
            eval_set=[(X_vl_s, y_vl)],
            verbose=False,
        )

        # Calibrate probabilities using the validation set (isotonic regression)
        calibrated = CalibratedClassifierCV(
            estimator=base_xgb,
            method="isotonic",
            cv="prefit",
        )
        calibrated.fit(X_vl_s, y_vl)
        self.model = calibrated

        # Metrics
        val_pred = calibrated.predict(X_vl_s)
        val_proba = calibrated.predict_proba(X_vl_s)
        test_pred = calibrated.predict(X_te_s)
        test_proba = calibrated.predict_proba(X_te_s)

        val_metrics = {
            **self._compute_ml_metrics(y_vl, val_pred, val_proba),
            **self._compute_trading_metrics(y_vl, val_pred),
        }
        test_metrics = {
            **self._compute_ml_metrics(y_te, test_pred, test_proba),
            **self._compute_trading_metrics(y_te, test_pred),
        }

        self.is_trained = True
        logger.info(
            "DirectionModel trained",
            extra={"val_accuracy": val_metrics.get("accuracy"), "test_accuracy": test_metrics.get("accuracy")},
        )
        return {"validation_metrics": val_metrics, "test_metrics": test_metrics}

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def predict(self, X: pd.DataFrame) -> Dict[str, np.ndarray]:
        """Return probability arrays for each direction.

        Returns dict with keys: ``probability_up``, ``probability_down``,
        ``probability_neutral``.
        """
        if not self.is_trained or self.model is None:
            raise ValueError("Model has not been trained yet.  Call train() first.")

        X_aligned = self._align_features(X)
        X_scaled = self.scaler.transform(X_aligned.values)
        proba = self.model.predict_proba(X_scaled)  # shape (n, 3): DOWN, NEUTRAL, UP

        # Clamp and renormalise to guarantee valid probability simplex
        proba = np.clip(proba, 0.0, 1.0)
        row_sums = proba.sum(axis=1, keepdims=True)
        proba = proba / np.where(row_sums == 0, 1, row_sums)

        return {
            "probability_down": proba[:, _DOWN],
            "probability_neutral": proba[:, _NEUTRAL],
            "probability_up": proba[:, _UP],
        }

    def predict_single(self, features: Dict[str, float]) -> Dict[str, float]:
        """Predict for a single feature vector.

        Returns probability_up, probability_down, probability_neutral, confidence.
        confidence = max(prob_up, prob_down) - prob_neutral
        """
        X = pd.DataFrame([features])
        result = self.predict(X)
        p_up = float(result["probability_up"][0])
        p_down = float(result["probability_down"][0])
        p_neutral = float(result["probability_neutral"][0])
        confidence = float(max(p_up, p_down) - p_neutral)
        confidence = float(np.clip(confidence, 0.0, 1.0))
        return {
            "probability_up": p_up,
            "probability_down": p_down,
            "probability_neutral": p_neutral,
            "confidence": confidence,
        }

    # ------------------------------------------------------------------
    # Metrics helpers
    # ------------------------------------------------------------------

    def _compute_ml_metrics(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        y_proba: np.ndarray,
    ) -> Dict[str, float]:
        metrics: Dict[str, float] = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
            "f1_weighted": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
            "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
            "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        }
        try:
            metrics["log_loss"] = float(log_loss(y_true, y_proba))
        except Exception:
            metrics["log_loss"] = float("nan")
        return metrics

    def _compute_trading_metrics(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
    ) -> Dict[str, float]:
        """Compute trading-relevant metrics.

        NOTE: win_rate > 0.5 does NOT imply profitability.
        """
        directional_mask = (y_pred != _NEUTRAL)
        n_signals = int(directional_mask.sum())
        n_neutral = int((y_pred == _NEUTRAL).sum())
        n_total = len(y_pred)

        if n_signals > 0:
            correct_directional = int(
                ((y_pred == y_true) & directional_mask).sum()
            )
            win_rate = correct_directional / n_signals
        else:
            win_rate = float("nan")

        return {
            "win_rate": float(win_rate),
            "signals_generated": float(n_signals),
            "neutral_rate": float(n_neutral / n_total if n_total > 0 else float("nan")),
        }

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, artifact_dir: str) -> str:
        """Save model artifacts.  Returns the artifact directory path."""
        if not self.is_trained or self.model is None:
            raise ValueError("Cannot save an untrained model.")
        os.makedirs(artifact_dir, exist_ok=True)

        model_path = os.path.join(artifact_dir, f"model_{self.version}.pkl")
        scaler_path = os.path.join(artifact_dir, f"scaler_{self.version}.pkl")
        meta_path = os.path.join(artifact_dir, f"metadata_{self.version}.json")

        joblib.dump(self.model, model_path)
        joblib.dump(self.scaler, scaler_path)
        metadata = {
            "version": self.version,
            "feature_names": self.feature_names,
            "params": self.params,
            "saved_at": datetime.now(tz=timezone.utc).isoformat(),
            "model_type": "DirectionModel",
        }
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info("DirectionModel saved", extra={"version": self.version, "dir": artifact_dir})
        return artifact_dir

    def load(self, artifact_dir: str, version: str) -> None:
        """Load model from artifact files."""
        model_path = os.path.join(artifact_dir, f"model_{version}.pkl")
        scaler_path = os.path.join(artifact_dir, f"scaler_{version}.pkl")
        meta_path = os.path.join(artifact_dir, f"metadata_{version}.json")

        self.model = joblib.load(model_path)
        self.scaler = joblib.load(scaler_path)
        with open(meta_path) as f:
            metadata = json.load(f)
        self.feature_names = metadata["feature_names"]
        self.version = version
        self.params = metadata.get("params", self.params)
        self.is_trained = True
        logger.info("DirectionModel loaded", extra={"version": version})

    # ------------------------------------------------------------------
    # Versioning
    # ------------------------------------------------------------------

    @staticmethod
    def get_next_version(artifact_dir: str, prefix: str) -> str:
        """Return the next version string, e.g. 'direction_v3'."""
        if not os.path.isdir(artifact_dir):
            return f"{prefix}1"
        existing: List[int] = []
        for fname in os.listdir(artifact_dir):
            if fname.startswith(f"model_{prefix}") and fname.endswith(".pkl"):
                num_str = fname[len(f"model_{prefix}"):-4]
                if num_str.isdigit():
                    existing.append(int(num_str))
        next_num = max(existing, default=0) + 1
        return f"{prefix}{next_num}"

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    def _align_features(self, X: pd.DataFrame) -> pd.DataFrame:
        """Ensure X has exactly the trained feature columns, in order."""
        missing = set(self.feature_names) - set(X.columns)
        if missing:
            raise ValueError(f"Missing feature columns: {missing}")
        return X[self.feature_names]
