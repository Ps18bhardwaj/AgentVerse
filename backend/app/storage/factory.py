"""Storage factory for dynamically configuring storage backend."""
from __future__ import annotations

import os
import logging
from functools import lru_cache

from .base import BaseStorageProvider
from .local import LocalStorageProvider

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_storage_provider() -> BaseStorageProvider:
    """Return configured BaseStorageProvider based on STORAGE_BACKEND environment variable."""
    backend_type = os.getenv("STORAGE_BACKEND", "local").lower().strip()

    if backend_type in ("s3", "r2", "supabase"):
        try:
            from .s3 import S3StorageProvider
            logger.info(f"Initializing S3 Storage Provider (type='{backend_type}')...")
            return S3StorageProvider()
        except Exception as e:
            logger.error(f"Failed to initialize S3 Storage Provider ({e}). Falling back to Local Storage.")
            return LocalStorageProvider()
    else:
        logger.info("Initializing Local Storage Provider...")
        return LocalStorageProvider()
