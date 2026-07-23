"""Knowledge Graph extraction module.

Extracts concept entities and relationship edges from document text chunks
to render interactive graph visualizations in the UI.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Any


@dataclass
class GraphNode:
    id: str
    label: str
    type: str  # 'doc', 'concept', 'section', 'entity'
    val: int = 1


@dataclass
class GraphLink:
    source: str
    target: str
    label: str = "relates to"
    weight: float = 1.0


def extract_document_graph(chunks: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a graph of document nodes, section nodes, and key concepts."""
    nodes: dict[str, GraphNode] = {}
    links: list[GraphLink] = []
    concept_counts: dict[str, int] = defaultdict(int)

    # Keywords / entity regex patterns (acronyms, camelCase, section titles, capitalized terms)
    entity_pattern = re.compile(r"\b([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*|[A-Z]{2,})\b")

    for chunk in chunks:
        doc_id = chunk.get("doc_id", "unknown_doc")
        doc_name = chunk.get("doc_name", "Document")
        text = chunk.get("text", "")
        section = chunk.get("section")

        # Ensure Document Node exists
        if doc_id not in nodes:
            nodes[doc_id] = GraphNode(id=doc_id, label=doc_name, type="doc", val=5)

        # Section Node if present
        if section:
            section_id = f"{doc_id}_sec_{section}"
            if section_id not in nodes:
                nodes[section_id] = GraphNode(id=section_id, label=section, type="section", val=3)
                links.append(GraphLink(source=doc_id, target=section_id, label="contains"))

        # Extract entities / terms
        matches = set(entity_pattern.findall(text))
        for match in matches:
            term = match.strip()
            if len(term) < 3 or term.lower() in {
                "the", "this", "that", "with", "from", "for", "and", "sources", "page", "section"
            }:
                continue
            concept_counts[term] += 1

            concept_id = f"concept_{term.lower()}"
            if concept_id not in nodes:
                nodes[concept_id] = GraphNode(id=concept_id, label=term, type="concept", val=2)

            parent_id = f"{doc_id}_sec_{section}" if section else doc_id
            links.append(GraphLink(source=parent_id, target=concept_id, label="mentions"))

    # Update concept node sizes based on frequency
    for term, count in concept_counts.items():
        cid = f"concept_{term.lower()}"
        if cid in nodes:
            nodes[cid].val = min(10, 2 + count)

    return {
        "nodes": [{"id": n.id, "label": n.label, "type": n.type, "val": n.val} for n in nodes.values()],
        "links": [{"source": l.source, "target": l.target, "label": l.label, "weight": l.weight} for l in links],
    }
