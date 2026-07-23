"""Background task processing module for document ingestion using Redis / Async task queue.

Prevents large PDF parsing, chunking, embedding generation, and Qdrant indexing
from blocking HTTP request workers. Supports progress tracking and status lookup.
"""
from __future__ import annotations

import os
import json
import uuid
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from enum import Enum

logger = logging.getLogger(__name__)

# Try establishing Redis connection if REDIS_URL is provided
_redis_client = None
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

try:
    import redis
    _redis_client = redis.Redis.from_url(REDIS_URL, socket_timeout=5.0, decode_responses=True)
    _redis_client.ping()
    logger.info(f"Connected to Redis task store at {REDIS_URL}")
except Exception as e:
    logger.info(f"Redis unavailable ({e}). Using in-memory job status store.")
    _redis_client = None

# Fallback in-memory status store for dev environments without Redis
_IN_MEMORY_JOBS: Dict[str, Dict[str, Any]] = {}


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


def create_job(doc_name: str) -> str:
    """Create a new tracking job ID and set initial status."""
    job_id = f"job-{uuid.uuid4()}"
    data = {
        "job_id": job_id,
        "doc_name": doc_name,
        "status": JobStatus.QUEUED.value,
        "progress": 0,
        "step": "queued",
        "error": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    _set_job_state(job_id, data)
    return job_id


def update_job(job_id: str, status: JobStatus, progress: int, step: str, error: Optional[str] = None, result: Optional[dict] = None) -> None:
    """Update progress state for a job."""
    data = get_job(job_id) or {"job_id": job_id, "created_at": datetime.utcnow().isoformat()}
    data["status"] = status.value
    data["progress"] = progress
    data["step"] = step
    data["updated_at"] = datetime.utcnow().isoformat()
    if error:
        data["error"] = error
    if result:
        data["result"] = result
    _set_job_state(job_id, data)


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve job status details from Redis or in-memory fallback."""
    if _redis_client:
        try:
            val = _redis_client.get(f"agentverse:job:{job_id}")
            if val:
                return json.loads(val)
        except Exception as e:
            logger.error(f"Failed to fetch job '{job_id}' from Redis: {e}")

    return _IN_MEMORY_JOBS.get(job_id)


def _set_job_state(job_id: str, data: Dict[str, Any]) -> None:
    if _redis_client:
        try:
            _redis_client.setex(f"agentverse:job:{job_id}", 86400, json.dumps(data))
        except Exception as e:
            logger.error(f"Failed to save job '{job_id}' to Redis: {e}")

    _IN_MEMORY_JOBS[job_id] = data
