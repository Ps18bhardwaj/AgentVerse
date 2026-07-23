"""DAG Workflow Execution Engine."""
from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List

from ..models import (
    WorkflowDefinition,
    WorkflowExecutionRequest,
    WorkflowRunResult,
    WorkflowStepResult,
)

PREBUILT_WORKFLOWS: List[WorkflowDefinition] = [
    WorkflowDefinition(
        id="wf-doc-intel",
        name="Enterprise Document Intelligence & Sync",
        description="Extract PDF data -> Summarize -> Notion Page -> Notify Team",
        nodes=[
            {"id": "n1", "type": "trigger", "label": "Document Ingested", "config": {}, "position": {"x": 50, "y": 100}},
            {"id": "n2", "type": "ocr", "label": "OCR & Extraction", "config": {}, "position": {"x": 250, "y": 100}},
            {"id": "n3", "type": "summarize", "label": "Executive Summary", "config": {}, "position": {"x": 450, "y": 100}},
            {"id": "n4", "type": "notion", "label": "Create Notion Page", "config": {}, "position": {"x": 650, "y": 50}},
            {"id": "n5", "type": "slack", "label": "Slack Notification", "config": {}, "position": {"x": 650, "y": 150}},
        ],
        edges=[
            {"id": "e1-2", "source": "n1", "target": "n2"},
            {"id": "e2-3", "source": "n2", "target": "n3"},
            {"id": "e3-4", "source": "n3", "target": "n4"},
            {"id": "e3-5", "source": "n3", "target": "n5"},
        ],
    ),
    WorkflowDefinition(
        id="wf-bug-triage",
        name="Automated GitHub & Email Bug Pipeline",
        description="Ingest Error Log -> Summarize -> GitHub Issue -> Email Ops",
        nodes=[
            {"id": "n1", "type": "trigger", "label": "Log Uploaded", "config": {}, "position": {"x": 50, "y": 100}},
            {"id": "n2", "type": "extract", "label": "Traceback Extraction", "config": {}, "position": {"x": 250, "y": 100}},
            {"id": "n3", "type": "github", "label": "Create GitHub Issue", "config": {}, "position": {"x": 450, "y": 100}},
            {"id": "n4", "type": "email", "label": "Dispatch Email Alert", "config": {}, "position": {"x": 650, "y": 100}},
        ],
        edges=[
            {"id": "e1-2", "source": "n1", "target": "n2"},
            {"id": "e2-3", "source": "n2", "target": "n3"},
            {"id": "e3-4", "source": "n3", "target": "n4"},
        ],
    ),
]


class WorkflowRunner:
    def __init__(self, workflow: WorkflowDefinition):
        self.workflow = workflow

    def execute(self, req: WorkflowExecutionRequest) -> WorkflowRunResult:
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        results: List[WorkflowStepResult] = []

        for node in self.workflow.nodes:
            t0 = time.perf_counter()
            step_output = self._run_node(node, req.input_data)
            duration_ms = int((time.perf_counter() - t0) * 1000)

            results.append(
                WorkflowStepResult(
                    node_id=node.id,
                    node_type=node.type,
                    status="completed",
                    output=step_output,
                    duration_ms=duration_ms,
                )
            )

        return WorkflowRunResult(
            run_id=run_id,
            workflow_id=self.workflow.id,
            status="completed",
            step_results=results,
            summary=f"Successfully executed all {len(results)} steps in workflow '{self.workflow.name}'.",
        )

    def _run_node(self, node: Any, input_data: Dict[str, Any]) -> Any:
        node_type = node.type if hasattr(node, "type") else node.get("type", "step")
        label = node.label if hasattr(node, "label") else node.get("label", "Node")

        if node_type == "trigger":
            return {"event": "trigger_fired", "payload": input_data}
        elif node_type == "ocr":
            return {"extracted_text": "Parsed document layout and 4 tabular regions."}
        elif node_type == "summarize":
            return {"summary": "AgentVerse Enterprise platform architecture overview."}
        elif node_type == "notion":
            return {"page_url": "https://notion.so/agentverse/page-10293", "created": True}

        elif node_type == "github":
            return {"issue_url": "https://github.com/org/repo/issues/42", "status": "opened"}
        elif node_type == "email":
            return {"status": "sent", "recipients": ["ops@company.com"]}
        elif node_type == "slack":
            return {"status": "posted", "channel": "#general"}
        else:
            return {"status": "processed", "node": label}
