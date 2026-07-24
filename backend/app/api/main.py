"""AgentVerse FastAPI app: ingest, list/delete docs, ask (sync + SSE stream)."""

from __future__ import annotations

import json
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Response, UploadFile, status

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from ..config import get_settings
from ..generation.answer import _collect_citations, generate_answer, stream_answer
from ..generation.rewrite import condense_question
from ..ingestion import docmeta
from ..ingestion.chunker import new_doc_id
from ..ingestion.loader import SUPPORTED_EXTENSIONS
from ..models import (
    AnswerResponse,
    AskRequest,
    DocumentInfo,
    IngestResponse,
)
from ..retrieval import store
from ..retrieval.pipeline import retrieve, retrieve_traced
from ..service import ingest_file, remove_document
from ..tracing_compat import flush
from ..warmup import is_ready, start_warmup

from ..db.database import init_db
from ..auth.security import get_current_active_user

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize persistent database tables
    init_db()
    # Preload the embedding + reranker models in the background so the first
    # user query doesn't pay the cold-load cost. /health exposes readiness.
    start_warmup()
    yield


app = FastAPI(
    title="AgentVerse API",

    description="RAG document intelligence with hybrid retrieval + reranking.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "img-src 'self' data: blob: https:; "
        "style-src 'self' 'unsafe-inline' https:; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
        "connect-src 'self' ws: wss: http: https:;"
    )
    return response



# Enterprise Feature Routers
from ..agents.router import router as agents_router
from ..workflows.router import router as workflows_router
from ..connectors.router import router as connectors_router
from ..ocr.router import router as ocr_router
from ..auth.router import router as auth_router
from ..human_loop.router import router as human_loop_router
from ..voice.router import router as voice_router
from ..observability.router import router as observability_router

app.include_router(agents_router)
app.include_router(workflows_router)
app.include_router(connectors_router)
app.include_router(ocr_router)
app.include_router(auth_router)
app.include_router(human_loop_router)
app.include_router(voice_router)
app.include_router(observability_router)



from ..retrieval.graph import extract_document_graph


from ..db.database import check_db_connection
from ..retrieval.store import check_qdrant_connection
import os


@app.get("/health")
def health() -> dict:
    """Liveness probe to confirm backend API worker status."""
    try:
        count = store.collection_count()
        qdrant_ok = True
    except Exception:
        count, qdrant_ok = 0, False
    return {
        "status": "ok",
        "qdrant_ok": qdrant_ok,
        "indexed_chunks": count,
        "models_ready": is_ready(),
    }


@app.get("/ready")
def readiness(response: Response) -> dict:
    """Readiness probe checking active DB connection, Qdrant Cloud cluster, and ML model warm-up."""
    db_ok = check_db_connection()
    qdrant_ok = check_qdrant_connection()
    models_ok = is_ready()

    all_ready = db_ok and qdrant_ok and models_ok
    if not all_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "ready": all_ready,
        "database_ok": db_ok,
        "qdrant_ok": qdrant_ok,
        "models_ready": models_ok,
    }


@app.get("/version")
def version() -> dict:
    """Return software version, deployment environment, and engine metadata."""
    return {
        "name": "AgentVerse Enterprise AI SaaS",
        "version": "2.5.0",
        "environment": settings.environment,
        "python_runtime": "3.11",
        "database_engine": "PostgreSQL" if "postgresql" in settings.database_url else "SQLite",
        "storage_backend": settings.storage_backend,
    }



@app.get("/graph")
def graph(current_user=Depends(get_current_active_user)) -> dict:
    chunks = [c.model_dump() for c in store.scroll_all_chunks()]
    return extract_document_graph(chunks)


@app.get("/analytics")
def analytics(current_user=Depends(get_current_active_user)) -> dict:
    docs = store.list_documents()
    chunks = store.scroll_all_chunks()
    return {
        "total_documents": len(docs),
        "total_chunks": len(chunks),
        "embedding_model": settings.embedding_model,
        "reranker_model": settings.reranker_model,
        "primary_model": settings.primary_model,
        "models_ready": is_ready(),
    }


from ..storage import get_storage_provider


@app.post("/ingest", response_model=IngestResponse)
async def ingest(
    files: list[UploadFile] = File(...),
    current_user=Depends(get_current_active_user),
) -> IngestResponse:

    if not files:
        raise HTTPException(400, "No files uploaded.")
    docs: list[DocumentInfo] = []
    storage = get_storage_provider()

    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                400,
                f"{f.filename}: unsupported file type. "
                f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}.",
            )
        # Strip any directory components to prevent path traversal (../../x.pdf).
        safe_name = Path(f.filename).name
        raw = await f.read()
        if not raw:
            raise HTTPException(400, f"{safe_name}: empty file.")
        # Store under the deterministic doc_id so same-named files can't
        # overwrite each other's bytes, and citations can serve the original.
        doc_id = new_doc_id(safe_name, raw)
        file_key = f"{doc_id}{ext}"
        storage.save_file(file_key, raw, content_type=f.content_type)

        # For temporary parsing, save local temp file if needed
        dest = settings.upload_dir / file_key
        dest.write_bytes(raw)
        try:
            info = ingest_file(str(dest), safe_name, raw)
        except ValueError as e:
            storage.delete_file(file_key)
            dest.unlink(missing_ok=True)
            detail: dict | str = str(e)
            if "scanned" in str(e).lower():
                detail = {
                    "code": "scanned_pdf",
                    "message": f"{safe_name}: this PDF appears to be scanned images "
                    "without extractable text. OCR isn't supported — export a "
                    "text-based PDF instead.",
                }
            raise HTTPException(422, detail)
        docs.append(info)
    return IngestResponse(documents=docs, total_chunks=sum(d.chunks for d in docs))


from ..tasks.queue import get_job


@app.get("/ingest/status/{job_id}")
def ingest_job_status(
    job_id: str,
    current_user=Depends(get_current_active_user),
) -> dict:
    """Retrieve async ingestion job status and progress percentage."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, f"Ingestion job '{job_id}' not found.")
    return job


@app.get("/documents", response_model=list[DocumentInfo])

def documents(current_user=Depends(get_current_active_user)) -> list[DocumentInfo]:
    docs = store.list_documents()
    # Merge sidecar intelligence (summary + suggested questions) if present.
    for d in docs:
        meta = docmeta.read_meta(d.doc_id)
        if meta:
            d.summary = meta.get("summary")
            d.suggested_questions = meta.get("questions") or []
    return docs


@app.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    current_user=Depends(get_current_active_user),
) -> dict:
    remove_document(doc_id)
    return {"deleted": doc_id}


_MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".md": "text/markdown",
}


@app.get("/documents/{doc_id}/file")
def document_file(
    doc_id: str,
    current_user=Depends(get_current_active_user),
):
    """Serve the original uploaded file using the abstract storage provider (used by citation viewer)."""
    doc = next((d for d in store.list_documents() if d.doc_id == doc_id), None)
    if doc is None:
        raise HTTPException(404, "Unknown document.")

    storage = get_storage_provider()

    for ext, media_type in _MEDIA_TYPES.items():
        file_key = f"{doc_id}{ext}"
        if storage.exists(file_key):
            # Check for direct presigned URL (e.g. S3/Cloudflare R2/Supabase)
            presigned_url = storage.get_file_url(file_key)
            if presigned_url:
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=presigned_url)

            data = storage.get_file(file_key)
            from fastapi import Response
            return Response(content=data, media_type=media_type, headers={"Content-Disposition": f'inline; filename="{doc.doc_name}"'})

    # Fallback to local upload directory if pre-existing
    upload_dir = settings.upload_dir.resolve()
    candidates = [upload_dir / f"{doc_id}{ext}" for ext in _MEDIA_TYPES]
    candidates.append(upload_dir / Path(doc.doc_name).name)
    for path in candidates:
        resolved = path.resolve()
        if resolved.is_file() and resolved.parent == upload_dir:
            return FileResponse(
                resolved,
                media_type=_MEDIA_TYPES.get(resolved.suffix.lower(), "application/octet-stream"),
                filename=doc.doc_name,
                content_disposition_type="inline",
            )
    raise HTTPException(404, "Original file is no longer available on the server.")

    raise HTTPException(404, "Original file is no longer available on the server.")


@app.post("/ask", response_model=AnswerResponse)
def ask(
    req: AskRequest,
    current_user=Depends(get_current_active_user),
) -> AnswerResponse:
    t0 = time.perf_counter()
    # Follow-ups are condensed into a standalone query before retrieval;
    # first turns (no history) skip the extra LLM call entirely.
    search_query, rewritten = condense_question(req.question, req.history)
    if req.include_trace:
        chunks, trace = retrieve_traced(
            search_query, top_k=req.top_k, doc_ids=req.doc_ids
        )
        trace.rewritten = rewritten
    else:
        chunks = retrieve(
            search_query, mode="hybrid_rerank", top_k=req.top_k, doc_ids=req.doc_ids
        )
        trace = None
    t1 = time.perf_counter()
    resp = generate_answer(req.question, chunks, req.history)
    t2 = time.perf_counter()
    resp.retrieval_ms = int((t1 - t0) * 1000)
    resp.generation_ms = int((t2 - t1) * 1000)
    resp.trace = trace
    flush()
    return resp


@app.post("/ask/stream")
def ask_stream(
    req: AskRequest,
    current_user=Depends(get_current_active_user),
) -> StreamingResponse:

    """Server-Sent Events: meta + sources (+ trace) first, then answer tokens."""
    search_query, rewritten = condense_question(req.question, req.history)
    if req.include_trace:
        chunks, trace = retrieve_traced(
            search_query, top_k=req.top_k, doc_ids=req.doc_ids
        )
        trace.rewritten = rewritten
    else:
        chunks = retrieve(
            search_query, mode="hybrid_rerank", top_k=req.top_k, doc_ids=req.doc_ids
        )
        trace = None

    def event_gen():
        # Tell the UI what was actually searched (follow-up rewriting).
        meta = {"query_used": search_query, "rewritten": rewritten}
        yield f"event: meta\ndata: {json.dumps(meta)}\n\n"

        # Emit sources up-front so the UI can render citation chips immediately.
        sources = [
            {
                "marker": i + 1,
                "chunk_id": rc.chunk.id,
                "doc_id": rc.chunk.doc_id,
                "doc_name": rc.chunk.doc_name,
                "page": rc.chunk.page,
                "section": rc.chunk.section,
                "score": rc.score,
            }
            for i, rc in enumerate(chunks)
        ]
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"

        if trace is not None:
            yield f"event: trace\ndata: {trace.model_dump_json()}\n\n"

        buffer = []
        for token in stream_answer(req.question, chunks, req.history):
            buffer.append(token)
            yield f"event: token\ndata: {json.dumps(token)}\n\n"

        answer = "".join(buffer)
        citations, grounded = _collect_citations(answer, chunks)
        payload = {
            "grounded": grounded,
            "citations": [c.model_dump() for c in citations],
        }
        yield f"event: done\ndata: {json.dumps(payload)}\n\n"
        flush()

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


from ..retrieval.graph import extract_document_graph


@app.get("/graph")
def get_knowledge_graph() -> dict:
    """Generate dynamic knowledge graph nodes and edges from stored chunks."""
    all_chunks = store.scroll_all_chunks()
    if not all_chunks:
        return {"nodes": [], "links": []}
    chunk_dicts = [c.model_dump() for c in all_chunks]
    return extract_document_graph(chunk_dicts)


@app.get("/")
def root() -> dict:
    return {"name": "AgentVerse", "docs": "/docs", "health": "/health"}

