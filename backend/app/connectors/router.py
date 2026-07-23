"""FastAPI endpoints for Enterprise Connectors."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from ..models import ConnectorConfig, ConnectorSyncRequest
from .manager import get_all_connectors, sync_connector, toggle_connector_status

router = APIRouter(prefix="/connectors", tags=["Connectors"])

@router.get("", response_model=list[ConnectorConfig])
def list_connectors() -> list[ConnectorConfig]:
    """List all available enterprise connectors and their sync status."""
    return get_all_connectors()

@router.post("/sync", response_model=ConnectorConfig)
def sync_integration(req: ConnectorSyncRequest) -> ConnectorConfig:
    """Trigger background sync for a connector."""
    try:
        return sync_connector(req.connector_id)
    except ValueError as e:
        raise HTTPException(404, str(e))

@router.post("/{connector_id}/toggle", response_model=ConnectorConfig)
def toggle_integration(connector_id: str) -> ConnectorConfig:
    """Toggle connection status for an enterprise integration."""
    try:
        return toggle_connector_status(connector_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
