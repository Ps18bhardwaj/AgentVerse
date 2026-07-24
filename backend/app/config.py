"""AgentVerse configuration (env-driven, free-tier & cloud production settings)."""
from __future__ import annotations

import os
import logging
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# AgentVerse is self-contained: load .env from the project, not a shared repo root.
_BACKEND_ROOT = Path(__file__).resolve().parents[1]   # 1-documind/backend
_PROJECT_ROOT = Path(__file__).resolve().parents[2]   # 1-documind


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_PROJECT_ROOT / ".env", _BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Environment & Environment Flags ---
    environment: str = "development"

    # --- Models ---
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    primary_model: str = "groq/llama-3.3-70b-versatile"
    fallback_model: str = "gemini/gemini-2.0-flash"
    rewrite_model: str = "groq/llama-3.1-8b-instant"

    # --- Qdrant ---
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    agentverse_collection: str = "agentverse_chunks"

    # --- Database ---
    database_url: str = f"sqlite:///{_BACKEND_ROOT / 'data' / 'agentverse.db'}"

    # --- Chunking ---
    chunk_tokens: int = 256
    chunk_overlap_ratio: float = 0.15

    # --- Retrieval ---
    dense_top_k: int = 20               # candidates from dense search
    bm25_top_k: int = 20                # candidates from lexical search
    rrf_k: int = 60                     # RRF damping constant
    final_top_k: int = 5                # after reranking
    rerank_candidates: int = 20         # how many fused candidates to rerank

    # --- API ---
    agentverse_api_port: int = 8000
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5175,http://127.0.0.1:3000,https://agentverse-1f1a.onrender.com"

    # --- Storage ---
    upload_dir: Path = _BACKEND_ROOT / "data" / "uploads"
    storage_backend: str = "local"

    @property
    def cors_origin_list(self) -> list[str]:
        origins = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS") or self.cors_origins
        return [o.strip() for o in origins.split(",") if o.strip()]

    @property
    def chunk_overlap_tokens(self) -> int:
        return int(self.chunk_tokens * self.chunk_overlap_ratio)

    def validate_env(self) -> None:
        """Validate production environment configuration and log warnings."""
        if not os.getenv("GROQ_API_KEY") and not os.getenv("GEMINI_API_KEY"):
            logger.warning("Neither GROQ_API_KEY nor GEMINI_API_KEY is configured. Answer generation will fail.")

        if self.environment == "production":
            if "sqlite" in self.database_url:
                logger.warning("PRODUCTION NOTICE: Database is configured to SQLite instead of PostgreSQL.")
            if "localhost" in self.qdrant_url:
                logger.warning("PRODUCTION NOTICE: Qdrant URL points to localhost instead of Qdrant Cloud.")
            if self.storage_backend == "local":
                logger.warning("PRODUCTION NOTICE: Storage backend is set to 'local' instead of S3/R2.")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.upload_dir.mkdir(parents=True, exist_ok=True)
    s.validate_env()
    return s
