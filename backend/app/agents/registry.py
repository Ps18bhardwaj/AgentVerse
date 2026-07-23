"""Registry of available enterprise agents and metadata."""
from __future__ import annotations

from typing import Any, Dict, List

AVAILABLE_AGENTS: List[Dict[str, Any]] = [
    {
        "id": "research",
        "name": "Research Agent",
        "category": "Intelligence",
        "description": "Deep cross-document research, literature synthesis, and evidence gathering.",
        "icon": "Search",
        "capabilities": ["Vector Search", "Citation Extraction", "Fact Verification"],
    },
    {
        "id": "coding",
        "name": "Coding Agent",
        "category": "Engineering",
        "description": "Code generation, architecture design, refactoring, and bug resolution.",
        "icon": "Code",
        "capabilities": ["Code Generation", "Refactoring", "Lint Verification"],
    },
    {
        "id": "writing",
        "name": "Writing Agent",
        "category": "Content",
        "description": "Executive briefs, polished documentation, blog posts, and summaries.",
        "icon": "FileText",
        "capabilities": ["Executive Summaries", "Tone Adjustment", "Markdown Formatting"],
    },
    {
        "id": "analysis",
        "name": "Analysis Agent",
        "category": "Data",
        "description": "Quantitative metrics extraction, data trends, and tabular insights.",
        "icon": "BarChart3",
        "capabilities": ["Data Extraction", "Metric Calculation", "Trend Analysis"],
    },
    {
        "id": "planning",
        "name": "Planning Agent",
        "category": "Operations",
        "description": "Strategic roadmaps, task breakdown, risk assessment, and timelines.",
        "icon": "Calendar",
        "capabilities": ["Task Breakdown", "Risk Matrix", "Timeline Estimation"],
    },
    {
        "id": "document",
        "name": "Document Agent",
        "category": "Intelligence",
        "description": "Document parsing, table extraction, section mapping, and OCR analysis.",
        "icon": "FolderSearch",
        "capabilities": ["Table Extraction", "OCR Parsing", "Metadata Extraction"],
    },
    {
        "id": "github",
        "name": "GitHub Agent",
        "category": "Engineering",
        "description": "Repository inspection, PR review, issue triage, and commit analysis.",
        "icon": "GitBranch",
        "capabilities": ["Repo Analysis", "PR Review", "Issue Drafting"],
    },
    {
        "id": "email",
        "name": "Email Agent",
        "category": "Communication",
        "description": "Email thread analysis, response drafting, and follow-up tracking.",
        "icon": "Mail",
        "capabilities": ["Thread Summary", "Response Drafting", "Action Tracking"],
    },
    {
        "id": "automation",
        "name": "Automation Agent",
        "category": "Workflow",
        "description": "API integration design, trigger workflows, and automated webhooks.",
        "icon": "Zap",
        "capabilities": ["API Triggers", "Webhook Integration", "Error Handlers"],
    },
    {
        "id": "meeting",
        "name": "Meeting Agent",
        "category": "Operations",
        "description": "Transcript summarization, decision tracking, and meeting minutes.",
        "icon": "Users",
        "capabilities": ["Transcript Parsing", "Action Items", "Decision Logs"],
    },
    {
        "id": "knowledge",
        "name": "Knowledge Agent",
        "category": "Knowledge",
        "description": "Entity extraction, knowledge graph population, and wiki generation.",
        "icon": "Network",
        "capabilities": ["Entity Linking", "Graph Extraction", "Wiki Indexing"],
    },
]


def list_agents() -> List[Dict[str, Any]]:
    return AVAILABLE_AGENTS
