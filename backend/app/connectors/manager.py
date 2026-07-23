"""Enterprise Integration Manager for external SaaS platforms."""
from __future__ import annotations

import time
from typing import List
from ..models import ConnectorConfig

DEFAULT_CONNECTORS: List[ConnectorConfig] = [
    ConnectorConfig(id="conn-gdrive", name="Google Drive", type="google_drive", status="connected", last_sync="2 mins ago", indexed_documents=42),
    ConnectorConfig(id="conn-github", name="GitHub Repositories", type="github", status="connected", last_sync="1 hour ago", indexed_documents=128),
    ConnectorConfig(id="conn-notion", name="Notion Workspaces", type="notion", status="connected", last_sync="15 mins ago", indexed_documents=34),
    ConnectorConfig(id="conn-slack", name="Slack Channels", type="slack", status="disconnected", last_sync=None, indexed_documents=0),
    ConnectorConfig(id="conn-jira", name="Jira Projects", type="jira", status="connected", last_sync="4 hours ago", indexed_documents=89),
    ConnectorConfig(id="conn-confluence", name="Confluence Wiki", type="confluence", status="disconnected", last_sync=None, indexed_documents=0),
    ConnectorConfig(id="conn-gmail", name="Gmail Threads", type="gmail", status="disconnected", last_sync=None, indexed_documents=0),
    ConnectorConfig(id="conn-dropbox", name="Dropbox Storage", type="dropbox", status="disconnected", last_sync=None, indexed_documents=0),
    ConnectorConfig(id="conn-arxiv", name="arXiv Research Papers", type="arxiv", status="connected", last_sync="1 day ago", indexed_documents=15),
]

_CONNECTOR_REGISTRY = {c.id: c for c in DEFAULT_CONNECTORS}

def get_all_connectors() -> List[ConnectorConfig]:
    return list(_CONNECTOR_REGISTRY.values())

def sync_connector(connector_id: str) -> ConnectorConfig:
    conn = _CONNECTOR_REGISTRY.get(connector_id)
    if not conn:
        raise ValueError(f"Connector '{connector_id}' not found.")
    conn.status = "connected"
    conn.last_sync = "Just now"
    conn.indexed_documents += 5
    return conn

def toggle_connector_status(connector_id: str) -> ConnectorConfig:
    conn = _CONNECTOR_REGISTRY.get(connector_id)
    if not conn:
        raise ValueError(f"Connector '{connector_id}' not found.")
    if conn.status == "connected":
        conn.status = "disconnected"
    else:
        conn.status = "connected"
        conn.last_sync = "Just now"
    return conn
