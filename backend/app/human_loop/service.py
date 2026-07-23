"""Human-in-the-Loop review queue service."""
from __future__ import annotations

import time
from typing import List
from ..models import ApprovalTask

DEFAULT_APPROVAL_TASKS: List[ApprovalTask] = [
    ApprovalTask(
        id="appr-101",
        source="Automation Agent",
        title="Dispatch Executive Weekly Summary Email",
        description="Send compiled PDF metrics report to c-suite@company.com",
        proposed_action={"email_to": "c-suite@company.com", "subject": "Weekly AI Digest", "attachments": 1},
        status="pending",
        created_at="10 mins ago",
    ),
    ApprovalTask(
        id="appr-102",
        source="GitHub Workflow Node",
        title="Publish Release v2.4 Tag to Main Repository",
        description="Create release branch and push tag to production repository",
        proposed_action={"repo": "acme/agentverse", "tag": "v2.4.0"},

        status="pending",
        created_at="25 mins ago",
    ),
]

_APPROVAL_STORE = {t.id: t for t in DEFAULT_APPROVAL_TASKS}


def get_pending_tasks() -> List[ApprovalTask]:
    return list(_APPROVAL_STORE.values())


def resolve_task(task_id: str, action: str, comment: str | None = None) -> ApprovalTask:
    task = _APPROVAL_STORE.get(task_id)
    if not task:
        raise ValueError(f"Approval task '{task_id}' not found.")
    task.status = action  # approved | rejected | edited
    task.reviewer_comment = comment
    return task
