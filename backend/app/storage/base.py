"""Abstract base interface for file storage backends."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class BaseStorageProvider(ABC):
    """Abstract interface defining standard operations for document file storage."""

    @abstractmethod
    def save_file(self, filename: str, content: bytes, content_type: Optional[str] = None) -> str:
        """Store file bytes and return the unique stored file key/path."""
        pass

    @abstractmethod
    def get_file(self, file_key: str) -> bytes:
        """Retrieve stored file bytes by file key."""
        pass

    @abstractmethod
    def delete_file(self, file_key: str) -> None:
        """Delete stored file by file key."""
        pass

    @abstractmethod
    def exists(self, file_key: str) -> bool:
        """Check if file exists in storage provider."""
        pass

    @abstractmethod
    def get_file_url(self, file_key: str) -> Optional[str]:
        """Return public or presigned download URL for file if available."""
        pass
