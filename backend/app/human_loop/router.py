"""FastAPI endpoints for Human-in-the-Loop review queue."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from ..models import ApprovalTask
from .service import get_pending_tasks, resolve_task

router = APIRouter(prefix="/human-loop", tags=["Human-in-the-Loop"])


@router.get("/tasks", response_model=list[ApprovalTask])
def list_approval_tasks() -> list[ApprovalTask]:
    """Retrieve pending review queue tasks requiring human approval."""
    return get_pending_tasks()


@router.post("/tasks/{task_id}/resolve", response_model=ApprovalTask)
def resolve_approval_task(task_id: str, action: str, comment: str | None = None) -> ApprovalTask:
    """Approve, reject, or request edits for an automated action."""
    try:
        return resolve_task(task_id, action, comment)
    except ValueError as e:
        raise HTTPException(404, str(e))
