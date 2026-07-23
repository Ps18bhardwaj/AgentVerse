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


def ensure_collection() -> None:
    """Ensure collection exists in Qdrant with matching vector dimensions and payload indices."""
    client = get_client()
    name = get_settings().agentverse_collection
    target_dim = embedding_dim()

    try:
        if client.collection_exists(name):
            info = client.get_collection(collection_name=name)
            # Validate embedding dimension alignment
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
        # Index doc_id keyword for fast per-document filtering
        client.create_payload_index(
            collection_name=name,
            field_name="doc_id",
            field_schema=qm.PayloadSchemaType.KEYWORD,
        )
        logger.info(f"Qdrant collection '{name}' created successfully.")
    except Exception as e:
        logger.error(f"Failed to ensure Qdrant collection '{name}': {e}")
        raise


def upsert_chunks(chunks: list[Chunk], vectors: list[list[float]], max_retries: int = 3) -> None:
    """Upsert chunk points with exponential backoff retries for cloud network stability."""
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
            logger.warning(f"Qdrant upsert attempt {attempt}/{max_retries} failed: {e}")
            if attempt == max_retries:
                logger.error(f"Qdrant upsert failed permanently after {max_retries} attempts.")
                raise
            time.sleep(0.5 * (2 ** (attempt - 1)))


def _payload_to_chunk(payload: dict) -> Chunk:
    return Chunk(**payload)


def dense_search(
    query_vector: list[float], top_k: int, doc_ids: list[str] | None = None
) -> list[RetrievedChunk]:
    """Execute dense vector similarity search in Qdrant with error handling."""
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
        return [
            RetrievedChunk(
                chunk=_payload_to_chunk(h.payload), score=float(h.score), source="dense"
            )
            for h in hits
        ]
    except Exception as e:
        logger.error(f"Dense vector search failed: {e}")
        return []


def scroll_all_chunks(doc_ids: list[str] | None = None) -> list[Chunk]:
    """Fetch every stored chunk (optionally filtered) — used to build BM25."""
    try:
        client = get_client()
        name = get_settings().agentverse_collection
        if not client.collection_exists(name):
            return []

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
        return out
    except Exception as e:
        logger.error(f"Qdrant scroll_all_chunks failed: {e}")
        return []


def list_documents() -> list[DocumentInfo]:
    """Compile distinct DocumentInfo summaries from indexed Qdrant chunk payloads."""
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
    """Delete all chunks for a specific document ID from Qdrant."""
    try:
        client = get_client()
        name = get_settings().agentverse_collection

        client.delete(
            collection_name=name,
            points_selector=qm.FilterSelector(filter=_doc_filter([doc_id])),
            wait=True,
        )
    except Exception as e:
        logger.error(f"Failed to delete document '{doc_id}' from Qdrant: {e}")
        raise


def collection_count() -> int:
    """Return total number of vector points stored in Qdrant collection."""
    try:
        s = get_settings()
        if "localhost" in s.qdrant_url and os.getenv("ENVIRONMENT") == "production":
            return 0
        client = get_client()
        name = s.agentverse_collection

        if not client.collection_exists(name):
            return 0
        return client.count(collection_name=name).count
    except Exception as e:
        logger.warning(f"Failed to count Qdrant points: {e}")
        return 0
