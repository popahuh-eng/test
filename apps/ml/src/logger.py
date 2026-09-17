"""Structured JSON logging for the ML service."""
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Optional


class _JsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        payload: dict = {
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "service": "ml",
            "event": record.getMessage(),
        }
        # Attach any extra fields set on the record
        for key, value in record.__dict__.items():
            if key not in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
            ):
                if not key.startswith("_"):
                    payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def get_logger(name: str = "ml", symbol: Optional[str] = None) -> logging.Logger:
    """Return a logger that emits structured JSON to stdout.

    Parameters
    ----------
    name:
        Logger name (module path recommended).
    symbol:
        Optional trading symbol to embed in every message via a LoggerAdapter.
    """
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JsonFormatter())
        logger.addHandler(handler)
        logger.propagate = False

    from src.config import settings
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logger.setLevel(level)

    if symbol:
        return logging.LoggerAdapter(logger, extra={"symbol": symbol})  # type: ignore[return-value]
    return logger
