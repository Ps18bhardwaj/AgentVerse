"""FastAPI endpoints for Telemetry & System Observability."""
from __future__ import annotations

from fastapi import APIRouter
from ..models import SystemMetrics
from .telemetry import collect_system_metrics

router = APIRouter(prefix="/observability", tags=["Observability"])


@router.get("/metrics", response_model=SystemMetrics)
def get_metrics() -> SystemMetrics:
    """Retrieve OpenTelemetry performance, cost estimates, and system metrics."""
    return collect_system_metrics()
