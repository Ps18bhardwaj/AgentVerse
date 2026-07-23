"""FastAPI router for Enterprise AI Agents endpoints."""
from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..models import AgentRunResult, AgentTaskRequest
from .framework import EnterpriseAgentEngine
from .registry import list_agents

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("", response_model=list[dict])
def get_available_agents() -> list[dict]:
    """List all 11 enterprise agent personas and capabilities."""
    return list_agents()


@router.post("/run", response_model=AgentRunResult)
async def run_agent_sync(request: AgentTaskRequest) -> AgentRunResult:
    """Execute an agent task synchronously and return execution steps and output."""
    engine = EnterpriseAgentEngine(request.agent_type)
    return await engine.execute_task_sync(request)


@router.post("/stream")
async def run_agent_stream(request: AgentTaskRequest) -> StreamingResponse:
    """Stream agent reasoning steps, tool executions, and result tokens via SSE."""
    engine = EnterpriseAgentEngine(request.agent_type)

    async def event_generator():
        async for event in engine.execute_task_stream(request):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
