"""Structured JSON and production logging configuration for AgentVerse."""
from __future__ import annotations

import os
import json
import logging
from datetime import datetime


class JSONFormatter(logging.Formatter):
    """Format log entries as structured JSON objects for Cloudwatch/Datadog/Railway."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "name": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)


def configure_logging() -> None:
    """Configure system-wide logging based on ENVIRONMENT environment variable."""
    env = os.getenv("ENVIRONMENT", "development").lower()
    log_level = logging.DEBUG if env == "development" else logging.INFO

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers
    root_logger.handlers.clear()

    handler = logging.StreamHandler()
    if env == "production":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s [%(name)s]: %(message)s"))

    root_logger.addHandler(handler)
