"""Pydantic request / response schemas for the ML service."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    symbol: str
    timeframe: str
    features: Dict[str, float]          # feature name -> value
    model_name: str = "direction"
    features_version: str = "v1"


class PredictResponse(BaseModel):
    symbol: str
    timeframe: str
    timestamp: datetime
    probability_up: float = Field(ge=0.0, le=1.0)
    probability_down: float = Field(ge=0.0, le=1.0)
    probability_neutral: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    expected_volatility: Optional[float] = None
    market_regime: str
    model_version: str
    features_version: str
    is_demo: bool


class TrainRequest(BaseModel):
    symbol: str
    timeframe: str
    start_date: str                      # ISO format date string
    end_date: str                        # ISO format date string
    model_name: str = "direction"
    hyperparameters: Optional[Dict[str, Any]] = None


class TrainResponse(BaseModel):
    model_name: str
    version: str
    training_period: str
    validation_metrics: Dict[str, float]
    test_metrics: Dict[str, float]
    feature_count: int
    training_samples: int
    status: str


class ModelInfo(BaseModel):
    model_name: str
    version: str
    features_version: str
    training_start: datetime
    training_end: datetime
    validation_metrics: Dict[str, float]
    test_metrics: Dict[str, float]
    is_active: bool
    created_at: datetime


class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    models_loaded: int
    timestamp: datetime
