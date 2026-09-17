"""Market regime classifier.

Classes:
    TREND_UP (0), TREND_DOWN (1), RANGE (2),
    HIGH_VOLATILITY (3), LOW_VOLATILITY (4)

Strategy: rule-based classification refined by XGBoost when a trained model
is available.  Falls back to the rule-based classifier gracefully.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from src.logger import get_logger

logger = get_logger(__name__)

REGIME_LABELS = {
    0: "TREND_UP",
    1: "TREND_DOWN",
    2: "RANGE",
    3: "HIGH_VOLATILITY",
    4: "LOW_VOLATILITY",
}
REGIME_TO_INT = {v: k for k, v in REGIME_LABELS.items()}


def _rule_based_regime(df: pd.DataFrame) -> pd.Series:
    """Apply deterministic rule-based regime classification.

    Requires columns: adx_14, trend_direction, realized_vol_20.
    """
    labels = pd.Series(REGIME_TO_INT["RANGE"], index=df.index, dtype=int)

    if "realized_vol_20" in df.columns:
        vol = df["realized_vol_20"]
        vol_high_thresh = vol.expanding().quantile(0.80)
        vol_low_thresh = vol.expanding().quantile(0.20)
        labels = labels.where(~(vol > vol_high_thresh), other=REGIME_TO_INT["HIGH_VOLATILITY"])
        labels = labels.where(~(vol < vol_low_thresh), other=REGIME_TO_INT["LOW_VOLATILITY"])

    if "adx_14" in df.columns and "trend_direction" in df.columns:
        adx = df["adx_14"]
        td = df["trend_direction"]
        trending = adx > 25
        labels = labels.where(~(trending & (td > 0)), other=REGIME_TO_INT["TREND_UP"])
        labels = labels.where(~(trending & (td < 0)), other=REGIME_TO_INT["TREND_DOWN"])

    return labels


class RegimeModel:
    """Market regime classifier (rule-based + XGBoost hybrid)."""

    VERSION_PREFIX = "regime_v"

    def __init__(self, hyperparameters: Optional[Dict] = None) -> None:
        default_params: Dict = {
            "n_estimators": 200,
            "max_depth": 5,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 3,
            "gamma": 0.1,
            "reg_alpha": 0.1,
            "reg_lambda": 1.0,
            "random_state": 42,
            "n_jobs": -1,
            "eval_metric": "mlogloss",
            "num_class": 5,
            "objective": "multi:softprob",
        }
        if hyperparameters:
            default_params.update(hyperparameters)
        self.params = default_params
        self.model: Optional[XGBClassifier] = None
        self.scaler: StandardScaler = StandardScaler()
        self.feature_names: List[str] = []
        self.version: str = ""
        self.is_trained: bool = False

    # ------------------------------------------------------------------

    def generate_labels(self, df: pd.DataFrame) -> pd.Series:
        """Generate rule-based regime labels (for training target)."""
        return _rule_based_regime(df)

    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
    ) -> Dict:
        self.feature_names = list(X_train.columns)

        X_tr_s = self.scaler.fit_transform(X_train.values)
        X_vl_s = self.scaler.transform(X_val.values)
        X_te_s = self.scaler.transform(X_test.values)

        self.model = XGBClassifier(
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

        val_metrics = {
            "accuracy": float(accuracy_score(y_val.values, val_pred)),
            "f1_macro": float(f1_score(y_val.values, val_pred, average="macro", zero_division=0)),
        }
        test_metrics = {
            "accuracy": float(accuracy_score(y_test.values, test_pred)),
            "f1_macro": float(f1_score(y_test.values, test_pred, average="macro", zero_division=0)),
        }

        self.is_trained = True
        logger.info("RegimeModel trained", extra={"val_acc": val_metrics["accuracy"]})
        return {"validation_metrics": val_metrics, "test_metrics": test_metrics}

    def predict(self, X: pd.DataFrame) -> List[str]:
        """Return regime name for each row.  Falls back to rule-based if not trained."""
        if not self.is_trained or self.model is None:
            rule_labels = _rule_based_regime(X)
            return [REGIME_LABELS.get(int(v), "RANGE") for v in rule_labels]

        X_aligned = self._align_features(X)
        X_scaled = self.scaler.transform(X_aligned.values)
        preds = self.model.predict(X_scaled)
        return [REGIME_LABELS.get(int(p), "RANGE") for p in preds]

    def predict_single(self, features: Dict[str, float]) -> str:
        """Predict regime for a single feature vector."""
        X = pd.DataFrame([features])
        return self.predict(X)[0]

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
            "model_type": "RegimeModel",
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
        available = [c for c in self.feature_names if c in X.columns]
        missing = set(self.feature_names) - set(X.columns)
        if missing:
            raise ValueError(f"Missing regime model feature columns: {missing}")
        return X[available]
