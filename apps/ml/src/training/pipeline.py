"""End-to-end training pipeline with strict no-look-ahead safety checks."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd

from src import db
from src.config import settings
from src.features.engineering import FeatureEngineer
from src.labels.generator import LabelGenerator
from src.logger import get_logger
from src.models.direction_model import DirectionModel
from src.models.regime_model import RegimeModel
from src.models.schemas import TrainRequest, TrainResponse
from src.models.volatility_model import VolatilityModel

logger = get_logger(__name__)


class TrainingPipeline:
    """End-to-end training pipeline.

    Steps
    -----
    1.  Fetch candles from PostgreSQL
    2.  Validate data quality
    3.  Compute features (FeatureEngineer)
    4.  Generate labels (LabelGenerator)
    5.  Chronological train / val / test split (no random shuffle)
    6.  Train direction, volatility and regime models
    7.  Evaluate all models
    8.  Save artifacts
    9.  Register in ``model_versions`` table
    10. Return TrainResponse

    CRITICAL SAFETY CHECKS
    ----------------------
    - train_end < val_start < test_start  (verified explicitly)
    - Labels never use features beyond the label horizon
    - No data after ``end_date`` leaks into any split
    """

    TRAIN_RATIO: float = 0.70
    VAL_RATIO: float = 0.15
    TEST_RATIO: float = 0.15
    MIN_TRAINING_SAMPLES: int = 500

    def __init__(self, artifact_dir: Optional[str] = None) -> None:
        self.artifact_dir = artifact_dir or settings.MODEL_ARTIFACTS_DIR
        self.engineer = FeatureEngineer(features_version=settings.FEATURES_VERSION)
        self.label_gen = LabelGenerator()

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def run(self, request: TrainRequest) -> TrainResponse:
        """Execute the complete training pipeline and return a TrainResponse."""
        symbol = request.symbol
        timeframe = request.timeframe
        start_dt = datetime.fromisoformat(request.start_date).replace(tzinfo=timezone.utc)
        end_dt = datetime.fromisoformat(request.end_date).replace(tzinfo=timezone.utc)

        logger.info(
            "TrainingPipeline starting",
            extra={"symbol": symbol, "timeframe": timeframe,
                   "start": request.start_date, "end": request.end_date},
        )

        # 1. Fetch candles
        candles = self._fetch_candles(symbol, timeframe, start_dt, end_dt)

        # 2. Validate data quality
        self._validate_data_quality(candles)

        # 3. Compute features
        features_df = self.engineer.compute_features(candles.copy(), symbol, timeframe)

        # 4. Generate labels
        direction_labels = self.label_gen.generate_direction_labels(features_df, timeframe)
        volatility_labels = self.label_gen.generate_volatility_labels(features_df, timeframe)
        regime_model_tmp = RegimeModel()
        regime_labels = regime_model_tmp.generate_labels(features_df)

        # Drop rows with NaN features or NaN direction labels
        feature_names = self.engineer.get_feature_names()
        combined = features_df[feature_names].copy()
        combined["_direction"] = direction_labels.values
        combined["_volatility"] = volatility_labels.values
        combined["_regime"] = regime_labels.values
        combined.dropna(subset=feature_names + ["_direction"], inplace=True)

        if len(combined) < self.MIN_TRAINING_SAMPLES:
            raise ValueError(
                f"Insufficient training samples after cleaning: {len(combined)} "
                f"(minimum {self.MIN_TRAINING_SAMPLES})"
            )

        # 5. Chronological split
        X = combined[feature_names]
        y_dir = combined["_direction"]
        y_vol = combined["_volatility"]
        y_reg = combined["_regime"]

        X_train, X_val, X_test = self._chronological_split(X)
        y_dir_tr, y_dir_vl, y_dir_te = (
            y_dir.iloc[: len(X_train)],
            y_dir.iloc[len(X_train): len(X_train) + len(X_val)],
            y_dir.iloc[len(X_train) + len(X_val):],
        )
        y_vol_tr, y_vol_vl, y_vol_te = (
            y_vol.iloc[: len(X_train)].dropna(),
            y_vol.iloc[len(X_train): len(X_train) + len(X_val)].dropna(),
            y_vol.iloc[len(X_train) + len(X_val):].dropna(),
        )
        y_reg_tr = y_reg.iloc[: len(X_train)]
        y_reg_vl = y_reg.iloc[len(X_train): len(X_train) + len(X_val)]
        y_reg_te = y_reg.iloc[len(X_train) + len(X_val):]

        # Safety check
        self._validate_no_lookahead(X_train, X_val, X_test)

        logger.info(
            "Data split complete",
            extra={
                "train": len(X_train),
                "val": len(X_val),
                "test": len(X_test),
                "train_end": str(X_train.index[-1]),
                "val_start": str(X_val.index[0]),
                "test_start": str(X_test.index[0]),
            },
        )

        # 6. Determine model versions
        model_subdir = os.path.join(self.artifact_dir, symbol, timeframe)

        dir_version = DirectionModel.get_next_version(model_subdir, DirectionModel.VERSION_PREFIX)
        vol_version = VolatilityModel.get_next_version(model_subdir, VolatilityModel.VERSION_PREFIX)
        reg_version = RegimeModel.get_next_version(model_subdir, RegimeModel.VERSION_PREFIX)

        # 7. Train direction model
        direction_mdl = DirectionModel(hyperparameters=request.hyperparameters)
        direction_mdl.version = dir_version
        dir_result = direction_mdl.train(X_train, y_dir_tr, X_val, y_dir_vl, X_test, y_dir_te)
        direction_mdl.save(model_subdir)

        # 8. Train volatility model (only if vol labels are sufficient)
        vol_val_metrics: Dict = {}
        vol_test_metrics: Dict = {}
        vol_mdl = VolatilityModel(hyperparameters=request.hyperparameters)
        vol_mdl.version = vol_version
        if len(y_vol_tr) >= 50 and len(y_vol_vl) >= 10:
            X_vol_tr = X_train.loc[y_vol_tr.index]
            X_vol_vl = X_val.loc[y_vol_vl.index]
            X_vol_te = X_test.loc[y_vol_te.index] if len(y_vol_te) > 0 else X_test.iloc[:0]
            y_vol_te_final = y_vol_te if len(y_vol_te) > 0 else y_vol_vl.iloc[:0]
            vol_result = vol_mdl.train(X_vol_tr, y_vol_tr, X_vol_vl, y_vol_vl, X_vol_te, y_vol_te_final)
            vol_mdl.save(model_subdir)
            vol_val_metrics = vol_result["validation_metrics"]
            vol_test_metrics = vol_result["test_metrics"]
        else:
            logger.warning("Insufficient volatility labels – skipping volatility model training")

        # 9. Train regime model
        regime_mdl = RegimeModel(hyperparameters=request.hyperparameters)
        regime_mdl.version = reg_version
        reg_result = regime_mdl.train(X_train, y_reg_tr, X_val, y_reg_vl, X_test, y_reg_te)
        regime_mdl.save(model_subdir)

        # 10. Register in DB (best-effort – log errors but don't abort)
        for m_name, m_ver, m_val, m_test in [
            ("direction", dir_version, dir_result["validation_metrics"], dir_result["test_metrics"]),
            ("volatility", vol_version, vol_val_metrics, vol_test_metrics),
            ("regime", reg_version, reg_result["validation_metrics"], reg_result["test_metrics"]),
        ]:
            try:
                db.execute_query(
                    """
                    INSERT INTO model_versions
                        (model_name, version, artifact_path, features_version,
                         training_start, training_end,
                         validation_metrics, test_metrics, hyperparameters,
                         is_active, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, FALSE, NOW())
                    """,
                    (
                        m_name, m_ver, model_subdir, settings.FEATURES_VERSION,
                        start_dt, end_dt,
                        __import__("json").dumps(m_val),
                        __import__("json").dumps(m_test),
                        __import__("json").dumps(request.hyperparameters or {}),
                    ),
                )
            except Exception as exc:
                logger.warning("Failed to register model in DB", extra={"model": m_name, "error": str(exc)})

        return TrainResponse(
            model_name=request.model_name,
            version=dir_version,
            training_period=f"{request.start_date} to {request.end_date}",
            validation_metrics=dir_result["validation_metrics"],
            test_metrics=dir_result["test_metrics"],
            feature_count=len(feature_names),
            training_samples=len(X_train),
            status="completed",
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fetch_candles(
        self,
        symbol: str,
        timeframe: str,
        start: datetime,
        end: datetime,
    ) -> pd.DataFrame:
        """Fetch candles from the PostgreSQL candles table."""
        rows = db.fetch_many(
            """
            SELECT timestamp, open, high, low, close, volume
            FROM candles
            WHERE symbol = %s
              AND timeframe = %s
              AND timestamp >= %s
              AND timestamp <= %s
            ORDER BY timestamp ASC
            """,
            (symbol, timeframe, start, end),
        )
        if not rows:
            raise ValueError(
                f"No candles found for {symbol} {timeframe} "
                f"between {start.isoformat()} and {end.isoformat()}"
            )
        df = pd.DataFrame(rows)
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        for col in ("open", "high", "low", "close", "volume"):
            df[col] = pd.to_numeric(df[col], errors="coerce")
        return df.sort_values("timestamp").reset_index(drop=True)

    def _validate_data_quality(self, df: pd.DataFrame) -> None:
        """Raise ValueError if data has quality issues."""
        n = len(df)

        # Duplicates
        n_dup = df.duplicated(subset=["timestamp"]).sum()
        if n_dup > 0:
            raise ValueError(f"Duplicate timestamps found: {n_dup}")

        # Impossible OHLC
        invalid_ohlc = (
            (df["high"] < df["low"]) |
            (df["high"] < df["open"]) |
            (df["high"] < df["close"]) |
            (df["low"] > df["open"]) |
            (df["low"] > df["close"])
        )
        n_invalid = int(invalid_ohlc.sum())
        if n_invalid > 0:
            raise ValueError(f"Invalid OHLC bars: {n_invalid}")

        # Non-positive prices
        n_nonpos = int((df[["open", "high", "low", "close"]] <= 0).any(axis=1).sum())
        if n_nonpos > 0:
            raise ValueError(f"Non-positive price bars: {n_nonpos}")

        # NaN in price columns
        n_nan = int(df[["open", "high", "low", "close", "volume"]].isna().any(axis=1).sum())
        if n_nan > int(n * 0.01):  # allow up to 1 % NaN
            raise ValueError(f"Too many NaN rows in candle data: {n_nan}/{n}")

        logger.info("Data quality validated", extra={"rows": n, "nan_rows": n_nan})

    def _chronological_split(
        self, df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Split data chronologically (no shuffling)."""
        n = len(df)
        train_end = int(n * self.TRAIN_RATIO)
        val_end = train_end + int(n * self.VAL_RATIO)

        train = df.iloc[:train_end]
        val = df.iloc[train_end:val_end]
        test = df.iloc[val_end:]
        return train, val, test

    def _validate_no_lookahead(
        self,
        train_df: pd.DataFrame,
        val_df: pd.DataFrame,
        test_df: pd.DataFrame,
    ) -> None:
        """Assert chronological order of splits."""
        train_end_idx = train_df.index[-1]
        val_start_idx = val_df.index[0]
        test_start_idx = test_df.index[0]

        assert train_end_idx < val_start_idx, (
            f"LEAKAGE: train_end={train_end_idx} >= val_start={val_start_idx}"
        )
        assert val_df.index[-1] < test_start_idx, (
            f"LEAKAGE: val_end={val_df.index[-1]} >= test_start={test_start_idx}"
        )
        logger.info(
            "No-lookahead validation passed",
            extra={
                "train_end_idx": int(train_end_idx),
                "val_start_idx": int(val_start_idx),
                "test_start_idx": int(test_start_idx),
            },
        )
