"""Local filesystem storage implementation for development."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from .base import BaseStorageProvider
from ..config import get_settings

logger = logging.getLogger(__name__)


class LocalStorageProvider(BaseStorageProvider):
    """Stores files on the local filesystem in upload_dir."""

    def __init__(self, upload_dir: Optional[Path] = None):
        self.upload_dir = upload_dir or get_settings().upload_dir
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _get_path(self, file_key: str) -> Path:
        # Sanitize path to prevent directory traversal
        safe_key = Path(file_key).name
        return self.upload_dir / safe_key

    def save_file(self, filename: str, content: bytes, content_type: Optional[str] = None) -> str:
        dest = self._get_path(filename)
        dest.write_bytes(content)
        logger.info(f"Local storage: saved {len(content)} bytes to {dest}")
        return filename

    def get_file(self, file_key: str) -> bytes:
        dest = self._get_path(file_key)
        if not dest.is_file():
            raise FileNotFoundError(f"Local file '{file_key}' not found at {dest}")
        return dest.read_bytes()

    def delete_file(self, file_key: str) -> None:
        dest = self._get_path(file_key)
        dest.unlink(missing_ok=True)
        logger.info(f"Local storage: deleted {file_key}")

    def exists(self, file_key: str) -> bool:
        return self._get_path(file_key).is_file()

    def get_file_url(self, file_key: str) -> Optional[str]:
        # Local files served directly via FastAPI route /documents/{doc_id}/file
        return None
