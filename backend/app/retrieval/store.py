"""Qdrant Cloud & local dense-vector store + document bookkeeping.

Provides production Qdrant Cloud connectivity, retry logic, timeout handling,
automatic collection provisioning, and vector dimension validation.
"""
from __future__ import annotations

import logging
import time
from functools import lru_cache
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from ..config import get_settings
from ..models import Chunk, DocumentInfo, RetrievedChunk
from .embeddings import embedding_dim

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_client() -> QdrantClient:
    """Instantiate and cache a resilient QdrantClient configured for Cloud or local deployment."""
    s = get_settings()
    url = s.qdrant_url
    api_key = s.qdrant_api_key or None
    logger.info(f"Connecting to Qdrant at {url} (cloud_authenticated={api_key is not None})")
    return QdrantClient(
        url=url,
        api_key=api_key,
        timeout=3.0,
    )


def check_qdrant_connection() -> bool:
    """Health & readiness probe to verify active connection to Qdrant cluster."""
    try:
        s = get_settings()
        if "localhost" in s.qdrant_url and os.getenv("ENVIRONMENT") == "production":
            return False
        client = get_client()
        name = s.agentverse_collection
        return client.collection_exists(name)
    except Exception as e:
        logger.warning(f"Qdrant connection health check failed: {e}")
        return False


def _doc_filter(doc_ids: list[str] | None) -> qm.Filter | None:
    if not doc_ids:
        return None
    return qm.Filter(
        must=[qm.FieldCondition(key="doc_id", match=qm.MatchAny(any=doc_ids))]
    )


import json
import math
import os
from pathlib import Path

_FALLBACK_FILE = Path(__file__).resolve().parents[2] / "data" / "fallback_chunks.json"


class FallbackStore:
    def __init__(self):
        self.chunks: dict[str, Chunk] = {}
        self.vectors: dict[str, list[float]] = {}
        self._load()

    def _load(self):
        if _FALLBACK_FILE.exists():
            try:
                data = json.loads(_FALLBACK_FILE.read_text(encoding="utf-8"))
                for item in data:
                    c = Chunk(**item["chunk"])
                    self.chunks[c.id] = c
                    self.vectors[c.id] = item["vector"]
            except Exception as e:
                logger.warning(f"Failed to load fallback store: {e}")

    def _save(self):
        try:
            _FALLBACK_FILE.parent.mkdir(parents=True, exist_ok=True)
            data = [
                {"chunk": self.chunks[cid].model_dump(), "vector": self.vectors[cid]}
                for cid in self.chunks
            ]
            _FALLBACK_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as e:
            logger.warning(f"Failed to save fallback store: {e}")

    def upsert(self, chunks: list[Chunk], vectors: list[list[float]]):
        for c, v in zip(chunks, vectors):
            self.chunks[c.id] = c
            self.vectors[c.id] = v
        self._save()

    def delete_doc(self, doc_id: str):
        to_del = [cid for cid, c in self.chunks.items() if c.doc_id == doc_id]
        for cid in to_del:
            self.chunks.pop(cid, None)
            self.vectors.pop(cid, None)
        self._save()

    def get_all_chunks(self, doc_ids: list[str] | None = None) -> list[Chunk]:
        out = list(self.chunks.values())
        if doc_ids:
            out = [c for c in out if c.doc_id in doc_ids]
        return out

    def cosine_search(self, query_vec: list[float], top_k: int, doc_ids: list[str] | None = None) -> list[RetrievedChunk]:
        def norm(v):
            return math.sqrt(sum(x * x for x in v)) or 1.0

        q_norm = norm(query_vec)
        results = []
        for cid, c in self.chunks.items():
            if doc_ids and c.doc_id not in doc_ids:
                continue
            v = self.vectors.get(cid)
            if not v or len(v) != len(query_vec):
                score = 0.0
            else:
                dot = sum(a * b for a, b in zip(query_vec, v))
                score = dot / (q_norm * norm(v))
            results.append(RetrievedChunk(chunk=c, score=float(score), source="dense"))

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:top_k]


_fallback = FallbackStore()


def ensure_collection() -> None:
    """Ensure collection exists in Qdrant with matching vector dimensions and payload indices."""
    try:
        client = get_client()
        name = get_settings().agentverse_collection
        target_dim = embedding_dim()

        if client.collection_exists(name):
            info = client.get_collection(collection_name=name)
            existing_dim = None
            if hasattr(info.config.params.vectors, 'size'):
                existing_dim = info.config.params.vectors.size
            elif isinstance(info.config.params.vectors, dict) and 'size' in info.config.params.vectors:
                existing_dim = info.config.params.vectors['size']

            if existing_dim and existing_dim != target_dim:
                logger.warning(
                    f"Collection '{name}' dimension mismatch: found {existing_dim}, expected {target_dim}."
                )
            return

        logger.info(f"Creating Qdrant collection '{name}' with dimension {target_dim} (Cosine)...")
        client.create_collection(
            collection_name=name,
            vectors_config=qm.VectorParams(
                size=target_dim, distance=qm.Distance.COSINE
            ),
        )
        client.create_payload_index(
            collection_name=name,
            field_name="doc_id",
            field_schema=qm.PayloadSchemaType.KEYWORD,
        )
        logger.info(f"Qdrant collection '{name}' created successfully.")
    except Exception as e:
        logger.warning(f"Qdrant collection check unavailable ({e}). Using local fallback store.")


def upsert_chunks(chunks: list[Chunk], vectors: list[list[float]], max_retries: int = 3) -> None:
    """Upsert chunk points with fallback mirroring."""
    _fallback.upsert(chunks, vectors)
    try:
        if not check_qdrant_connection():
            return
        client = get_client()
        name = get_settings().agentverse_collection

        points = [
            qm.PointStruct(id=c.id, vector=v, payload=c.model_dump())
            for c, v in zip(chunks, vectors)
        ]

        for attempt in range(1, max_retries + 1):
            try:
                client.upsert(collection_name=name, points=points, wait=True)
                return
            except Exception as e:
                if attempt == max_retries:
                    logger.warning(f"Qdrant upsert unavailable ({e}). Data persisted in fallback store.")
                    return
                time.sleep(0.2)
    except Exception as e:
        logger.warning(f"Qdrant client error ({e}). Chunk data persisted in local fallback store.")


def _payload_to_chunk(payload: dict) -> Chunk:
    return Chunk(**payload)


def dense_search(
    query_vector: list[float], top_k: int, doc_ids: list[str] | None = None
) -> list[RetrievedChunk]:
    """Execute dense vector similarity search in Qdrant with local fallback."""
    if check_qdrant_connection():
        try:
            client = get_client()
            name = get_settings().agentverse_collection

            hits = client.query_points(
                collection_name=name,
                query=query_vector,
                limit=top_k,
                query_filter=_doc_filter(doc_ids),
                with_payload=True,
            ).points
            if hits:
                return [
                    RetrievedChunk(
                        chunk=_payload_to_chunk(h.payload), score=float(h.score), source="dense"
                    )
                    for h in hits
                ]
        except Exception as e:
            logger.warning(f"Qdrant dense search unavailable ({e}). Using local cosine fallback.")

    return _fallback.cosine_search(query_vector, top_k, doc_ids)


def scroll_all_chunks(doc_ids: list[str] | None = None) -> list[Chunk]:
    """Fetch every stored chunk (optionally filtered) — used to build BM25."""
    if check_qdrant_connection():
        try:
            client = get_client()
            name = get_settings().agentverse_collection
            if client.collection_exists(name):
                out: list[Chunk] = []
                offset = None
                while True:
                    records, offset = client.scroll(
                        collection_name=name,
                        scroll_filter=_doc_filter(doc_ids),
                        with_payload=True,
                        with_vectors=False,
                        limit=256,
                        offset=offset,
                    )
                    out.extend(_payload_to_chunk(r.payload) for r in records)
                    if offset is None:
                        break
                if out:
                    return out
        except Exception as e:
            logger.warning(f"Qdrant scroll_all_chunks unavailable ({e}). Using local fallback store.")

    return _fallback.get_all_chunks(doc_ids)


def list_documents() -> list[DocumentInfo]:
    """Compile distinct DocumentInfo summaries from indexed Qdrant / fallback chunk payloads."""
    docs: dict[str, DocumentInfo] = {}
    for c in scroll_all_chunks():
        info = docs.get(c.doc_id)
        if info is None:
            docs[c.doc_id] = DocumentInfo(
                doc_id=c.doc_id,
                doc_name=c.doc_name,
                pages=c.page,
                chunks=1,
                source_type=c.source_type,
            )
        else:
            info.chunks += 1
            info.pages = max(info.pages, c.page)
    return sorted(docs.values(), key=lambda d: d.doc_name)


def delete_document(doc_id: str) -> None:
    """Delete all chunks for a specific document ID from Qdrant and fallback store."""
    _fallback.delete_doc(doc_id)
    try:
        client = get_client()
        name = get_settings().agentverse_collection

        client.delete(
            collection_name=name,
            points_selector=qm.FilterSelector(filter=_doc_filter([doc_id])),
            wait=True,
        )
    except Exception as e:
        logger.warning(f"Qdrant delete unavailable ({e}). Deleted from fallback store.")


def collection_count() -> int:
    """Return total number of vector points stored in Qdrant collection or fallback store."""
    try:
        client = get_client()
        name = get_settings().agentverse_collection

        if client.collection_exists(name):
            cnt = client.count(collection_name=name).count
            if cnt > 0:
                return cnt
    except Exception:
        pass
    return len(_fallback.chunks)
