"""Pydantic v2 schemas for AgentVerse structured I/O."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class Chunk(BaseModel):
    """A single retrievable unit, tied back to its source page."""

    id: str = Field(..., description="Deterministic uuid5 over doc_id+chunk_index.")
    doc_id: str
    doc_name: str
    page: int = Field(..., description="1-based page (PDF) or pseudo-page part number.")
    chunk_index: int
    text: str
    section: str | None = Field(None, description="Nearest heading, if detected.")
    token_count: int = 0
    source_type: str = Field("pdf", description="pdf | docx | text")


class Citation(BaseModel):
    """Page-level source citation surfaced to the UI."""

    marker: int = Field(..., description="The [n] number used inline in the answer.")
    doc_id: str
    doc_name: str
    page: int
    section: str | None = None
    snippet: str = Field(..., description="Short supporting excerpt from the chunk.")
    score: float = Field(0.0, description="Reranker relevance score.")
    source_type: str = Field("pdf", description="Gates the PDF viewer in the UI.")


class RetrievedChunk(BaseModel):
    chunk: Chunk
    score: float
    source: str = Field("hybrid", description="dense | bm25 | hybrid (post-fusion).")


class DocumentInfo(BaseModel):
    doc_id: str
    doc_name: str
    pages: int
    chunks: int
    source_type: str = "pdf"
    summary: str | None = None
    suggested_questions: list[str] = Field(default_factory=list)


class IngestResponse(BaseModel):
    documents: list[DocumentInfo]
    total_chunks: int


class ChatTurn(BaseModel):
    """One prior turn of the conversation, for follow-up question rewriting."""

    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=4000)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    doc_ids: list[str] | None = Field(
        None, description="Restrict retrieval to these documents; None = all."
    )
    top_k: int | None = Field(None, ge=1, le=20)
    history: list[ChatTurn] | None = Field(
        None,
        max_length=12,
        description="Prior turns; follow-ups are condensed into a standalone "
        "search query before retrieval.",
    )
    include_trace: bool = Field(
        False, description="Emit per-stage retrieval trace (dense/BM25/RRF/rerank)."
    )


class TraceEntry(BaseModel):
    """One candidate chunk at one stage of the retrieval pipeline."""

    chunk_id: str
    doc_name: str
    page: int
    rank: int
    score: float = Field(..., description="Stage-native score (cosine | bm25 | rrf | rerank).")


class RetrievalTrace(BaseModel):
    """Per-stage retrieval transparency for the UI's 'how was this found' panel."""

    query_used: str
    rewritten: bool = False
    dense: list[TraceEntry]
    bm25: list[TraceEntry]
    fused: list[TraceEntry]
    reranked: list[TraceEntry]
    timings_ms: dict[str, int] = Field(default_factory=dict)


class AnswerResponse(BaseModel):
    answer: str
    citations: list[Citation]
    grounded: bool = Field(
        True, description="False when the model fell back to 'not in the documents'."
    )
    retrieval_ms: int = 0
    generation_ms: int = 0
    trace: RetrievalTrace | None = None


# --- ENTERPRISE AGENTS SCHEMAS ---
class AgentTaskRequest(BaseModel):
    agent_type: str = Field(..., description="research | coding | writing | analysis | planning | document | github | email | automation | meeting | knowledge")
    prompt: str = Field(..., min_length=1)
    doc_ids: list[str] | None = None
    require_approval: bool = False
    context: dict[str, Any] = Field(default_factory=dict)

class AgentStep(BaseModel):
    step_index: int
    title: str
    status: Literal["pending", "running", "completed", "failed", "awaiting_approval"] = "pending"
    thought: str | None = None
    tool_call: str | None = None
    tool_output: str | None = None

class AgentRunResult(BaseModel):
    task_id: str
    agent_type: str
    status: Literal["completed", "failed", "awaiting_approval"]
    steps: list[AgentStep]
    result: str
    artifacts: list[dict[str, Any]] = Field(default_factory=list)


# --- VISUAL WORKFLOW SCHEMAS ---
class WorkflowNode(BaseModel):
    id: str
    type: str  # trigger | ocr | summarize | extract | notion | email | github | slack
    label: str
    config: dict[str, Any] = Field(default_factory=dict)
    position: dict[str, float] = Field(default_factory=dict)

class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str

class WorkflowDefinition(BaseModel):
    id: str
    name: str
    description: str = ""
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]

class WorkflowExecutionRequest(BaseModel):
    workflow_id: str
    input_data: dict[str, Any] = Field(default_factory=dict)

class WorkflowStepResult(BaseModel):
    node_id: str
    node_type: str
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    output: Any = None
    duration_ms: int = 0

class WorkflowRunResult(BaseModel):
    run_id: str
    workflow_id: str
    status: Literal["completed", "failed"]
    step_results: list[WorkflowStepResult]
    summary: str


# --- ENTERPRISE CONNECTORS SCHEMAS ---
class ConnectorConfig(BaseModel):
    id: str
    name: str
    type: str  # google_drive | github | gitlab | gmail | outlook | notion | slack | discord | dropbox | sharepoint | confluence | jira
    status: Literal["connected", "disconnected", "syncing", "error"] = "disconnected"
    last_sync: str | None = None
    indexed_documents: int = 0
    auto_sync: bool = True

class ConnectorSyncRequest(BaseModel):
    connector_id: str
    force_resync: bool = False


# --- AUTH & RBAC SCHEMAS ---
class UserRole(str, Enum):
    SYSTEM_OWNER = "System Owner"
    ADMIN = "Admin"
    MANAGER = "Manager"
    MEMBER = "Member"
    GUEST = "Guest"

class UserProfile(BaseModel):
    id: str
    first_name: str
    last_name: str
    name: str
    username: str
    email: str
    phone_number: str | None = None
    profile_picture: str | None = None
    role: str = "Member"
    permissions: list[str] = Field(default_factory=list)
    organization: str = "AgentVerse Enterprise"

    workspace: str | None = None
    account_status: str = "active"
    email_verified: bool = False
    two_factor_enabled: bool = False
    created_at: str | None = None
    updated_at: str | None = None
    last_login: str | None = None
    timezone: str = "UTC"
    language: str = "en"
    theme: str = "system"
    notification_preferences: dict[str, Any] = Field(default_factory=dict)
    api_keys: list[dict[str, Any]] = Field(default_factory=list)
    connected_accounts: list[dict[str, Any]] = Field(default_factory=list)

class LoginRequest(BaseModel):
    email_or_username: str
    password: str
    remember_me: bool = False

class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    user: UserProfile



# --- HUMAN IN THE LOOP SCHEMAS ---
class ApprovalTask(BaseModel):
    id: str
    source: str  # Agent or Workflow
    title: str
    description: str
    proposed_action: dict[str, Any]
    status: Literal["pending", "approved", "rejected", "edited"] = "pending"
    created_at: str
    reviewer_comment: str | None = None


# --- OBSERVABILITY SCHEMAS ---
class SystemMetrics(BaseModel):
    qdrant_status: str
    total_tokens_used: int
    estimated_cost_usd: float
    avg_latency_ms: float
    rag_grounding_score: float
    active_users: int
    total_documents: int
    total_chunks: int
    models: dict[str, str]

