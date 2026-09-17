"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os


class Settings(BaseSettings):
    """ML service settings, loaded from environment / .env file."""

    DATABASE_URL: str = Field(
        default="postgresql://postgres:password@localhost:5432/trading",
        description="PostgreSQL connection URL",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
    )
    ML_SERVICE_PORT: int = Field(default=8000, description="Port for the ML HTTP service")
    MODEL_ARTIFACTS_DIR: str = Field(
        default="./artifacts",
        description="Directory where model artifacts are stored",
    )
    FEATURES_VERSION: str = Field(default="v1", description="Feature engineering version tag")
    DEMO_MODE: bool = Field(
        default=False,
        description="When True the service returns clearly-marked demo predictions even without a trained model",
    )
    LOG_LEVEL: str = Field(default="INFO", description="Python logging level")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
