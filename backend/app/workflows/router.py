"""FastAPI endpoints for Multi-Step Visual Workflows."""
from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException

from ..models import (
    WorkflowDefinition,
    WorkflowExecutionRequest,
    WorkflowRunResult,
)
from .engine import PREBUILT_WORKFLOWS, WorkflowRunner

router = APIRouter(prefix="/workflows", tags=["Workflows"])

_WORKFLOW_STORE: dict[str, WorkflowDefinition] = {wf.id: wf for wf in PREBUILT_WORKFLOWS}


@router.get("", response_model=list[WorkflowDefinition])
def list_workflows() -> list[WorkflowDefinition]:
    """List registered visual workflows."""
    return list(_WORKFLOW_STORE.values())


@router.post("", response_model=WorkflowDefinition)
def create_workflow(wf: WorkflowDefinition) -> WorkflowDefinition:
    """Create or update a custom visual workflow."""
    if not wf.id:
        wf.id = f"wf-{uuid.uuid4().hex[:8]}"
    _WORKFLOW_STORE[wf.id] = wf
    return wf


@router.post("/execute", response_model=WorkflowRunResult)
def execute_workflow(req: WorkflowExecutionRequest) -> WorkflowRunResult:
    """Execute a visual DAG workflow by ID."""
    wf = _WORKFLOW_STORE.get(req.workflow_id)
    if not wf:
        raise HTTPException(404, f"Workflow '{req.workflow_id}' not found.")
    runner = WorkflowRunner(wf)
    return runner.execute(req)
