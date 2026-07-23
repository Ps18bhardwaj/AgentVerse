"""Storage package providing cloud and local file persistence abstractions."""
from .base import BaseStorageProvider
from .factory import get_storage_provider

__all__ = ["BaseStorageProvider", "get_storage_provider"]
