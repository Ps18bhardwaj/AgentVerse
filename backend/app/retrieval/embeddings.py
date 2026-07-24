"""Local dense embeddings via sentence-transformers (BAAI/bge-large-en-v1.5).

Local + CPU = unlimited and free (no API, no rate limits). bge models are
trained with an instruction prefix for *queries* but not for passages, so we
expose two methods to honour that asymmetry — it measurably helps recall.
"""
from __future__ import annotations

import threading
from functools import lru_cache

from ..config import get_settings

# bge-* recommended query instruction (passages are embedded raw).
_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

_lock = threading.Lock()


@lru_cache(maxsize=1)
def _model():
    # Imported lazily so the API process starts fast and memory footprint stays low
    try:
        import torch
        torch.set_num_threads(1)
        torch.set_num_interop_threads(1)
    except Exception:
        pass
    from sentence_transformers import SentenceTransformer

    settings = get_settings()
    return SentenceTransformer(settings.embedding_model)


def embedding_dim() -> int:
    try:
        return _model().get_sentence_embedding_dimension()
    except Exception:
        return 384


def embed_passages(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    if not texts:
        return []
    try:
        with _lock:  # SentenceTransformer isn't thread-safe under uvicorn workers
            vecs = _model().encode(
                texts,
                batch_size=batch_size,
                normalize_embeddings=True,   # cosine == dot product
                show_progress_bar=False,
            )
        return vecs.tolist()
    except Exception:
        dim = embedding_dim()
        return [[0.0] * dim for _ in texts]


def embed_query(query: str) -> list[float]:
    try:
        with _lock:
            vec = _model().encode(
                _QUERY_PREFIX + query,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
        return vec.tolist()
    except Exception:
        dim = embedding_dim()
        return [0.0] * dim
