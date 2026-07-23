import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Network, Sparkles, RefreshCw, FileText, Tag, Hash, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Node {
  id: string;
  label: string;
  type: "doc" | "section" | "concept";
  val: number;
}

interface Link {
  source: string;
  target: string;
  label: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

const FALLBACK_GRAPH: GraphData = {
  nodes: [
    { id: "n1", label: "AgentVerse Enterprise Workspace", type: "doc", val: 8 },

    { id: "n2", label: "RAG Retrieval Pipeline", type: "section", val: 5 },
    { id: "n3", label: "Hybrid Vector Search (Qdrant)", type: "concept", val: 4 },
    { id: "n4", label: "LiteLLM Router & Fallback Chain", type: "concept", val: 4 },
    { id: "n5", label: "Knowledge Graph Engine", type: "section", val: 5 },
    { id: "n6", label: "Entity Extraction Module", type: "concept", val: 3 },
    { id: "n7", label: "Zero-Trust Human Approval Queue", type: "concept", val: 3 },
    { id: "n8", label: "Multi-Modal OCR Vision Engine", type: "concept", val: 3 },
  ],
  links: [
    { source: "n1", target: "n2", label: "architected with" },
    { source: "n2", target: "n3", label: "queries" },
    { source: "n2", target: "n4", label: "streams via" },
    { source: "n1", target: "n5", label: "builds" },
    { source: "n5", target: "n6", label: "extracts" },
    { source: "n1", target: "n7", label: "enforces" },
    { source: "n1", target: "n8", label: "parses" },
  ],
};

export const KnowledgeGraphPanel: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const { data, isLoading, refetch } = useQuery<GraphData>({
    queryKey: ["knowledge-graph"],
    queryFn: async () => {
      const res = await fetch("/api/graph");
      if (!res.ok) throw new Error("Failed to fetch graph data");
      const json = await res.json();
      if (!json || !json.nodes || json.nodes.length === 0) {
        return FALLBACK_GRAPH;
      }
      return json;
    },
  });

  const activeGraph = data && data.nodes && data.nodes.length > 0 ? data : FALLBACK_GRAPH;

  const docNodes = activeGraph.nodes.filter((n) => n.type === "doc");
  const sectionNodes = activeGraph.nodes.filter((n) => n.type === "section");
  const conceptNodes = activeGraph.nodes.filter((n) => n.type === "concept");

  return (
    <div className="flex flex-col w-full h-full bg-background p-4 space-y-4 overflow-y-auto text-xs">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-sm">Knowledge Graph & Entities</h2>
            <p className="text-[11px] text-muted-foreground">
              {activeGraph.nodes.length} nodes &bull; {activeGraph.links.length} concept relationships
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          className="h-7 text-[10px] gap-1 border-border text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={isLoading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          Refresh
        </Button>
      </div>

      {/* Interactive Visual Graph Topology Box */}
      <div className="relative rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-4 space-y-3 overflow-hidden shadow-inner">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
            <Share2 className="h-3 w-3" /> Topology Visualization
          </span>
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[9px]">
            Live Concept Map
          </Badge>
        </div>

        {/* Visual Node Links Representation */}
        <div className="flex flex-wrap items-center justify-center gap-2 py-4 px-2 bg-black/40 rounded-xl border border-border">
          {activeGraph.nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelectedNode(n)}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all flex items-center gap-1.5 shadow-sm ${
                selectedNode?.id === n.id
                  ? "ring-2 ring-cyan-400 border-cyan-400 bg-cyan-500/30 text-white font-bold scale-105"
                  : n.type === "doc"
                  ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30"
                  : n.type === "section"
                  ? "bg-cyan-600/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30"
                  : "bg-purple-600/20 border-purple-500/40 text-purple-300 hover:bg-purple-600/30"
              }`}
            >
              {n.type === "doc" && <FileText className="h-3 w-3 text-indigo-400" />}
              {n.type === "section" && <Hash className="h-3 w-3 text-cyan-400" />}
              {n.type === "concept" && <Sparkles className="h-3 w-3 text-purple-400" />}
              <span>{n.label}</span>
            </button>
          ))}
        </div>

        {selectedNode && (
          <div className="p-3 rounded-xl bg-card border border-border text-xs space-y-1 animate-in fade-in">
            <span className="font-bold text-foreground">Selected Node: {selectedNode.label}</span>
            <p className="text-muted-foreground text-[11px]">
              Type: <Badge variant="outline" className="text-[9px]">{selectedNode.type}</Badge> &bull; Relationship Weight: {selectedNode.val}
            </p>
          </div>
        )}
      </div>

      {/* Grouped Entity Columns in Vertical Layout */}
      <div className="space-y-3">
        {/* Document Nodes */}
        {docNodes.length > 0 && (
          <div className="p-3 rounded-xl border border-border bg-card/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 border-b border-border/60 pb-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>Document Roots ({docNodes.length})</span>
            </div>
            <div className="space-y-1.5">
              {docNodes.map((n) => (
                <div key={n.id} className="p-2 rounded-lg bg-background border border-border flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate">{n.label}</span>
                  <Badge className="bg-indigo-600/20 text-indigo-300 text-[9px]">Root Node</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section Nodes */}
        {sectionNodes.length > 0 && (
          <div className="p-3 rounded-xl border border-border bg-card/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 border-b border-border/60 pb-1.5">
              <Hash className="h-3.5 w-3.5" />
              <span>Section Headers ({sectionNodes.length})</span>
            </div>
            <div className="space-y-1.5">
              {sectionNodes.map((n) => (
                <div key={n.id} className="p-2 rounded-lg bg-background border border-border flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate">{n.label}</span>
                  <Badge className="bg-cyan-600/20 text-cyan-300 text-[9px]">Section</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Concept Nodes */}
        {conceptNodes.length > 0 && (
          <div className="p-3 rounded-xl border border-border bg-card/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-400 border-b border-border/60 pb-1.5">
              <Tag className="h-3.5 w-3.5" />
              <span>Extracted Concepts ({conceptNodes.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {conceptNodes.map((n) => (
                <div
                  key={n.id}
                  className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-medium flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  <span>{n.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
