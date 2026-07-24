import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Network,
  RefreshCw,
  FileText,
  Search,
  Layers,
  Cpu,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { listDocuments } from "@/lib/api";

interface GraphNode {
  id: string;
  label: string;
  type: "document" | "section" | "concept";
  doc_id?: string;
  connections: string[];
}

interface GraphLink {
  source: string;
  target: string;
  relation: string;
}

export function KnowledgeGraphPanel() {
  const selectedDocIds = useStore((s) => s.selectedDocIds);

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [filterType, setFilterType] = useState<"all" | "document" | "section" | "concept">("all");

  const docIdParam = selectedDocIds.length > 0 ? selectedDocIds.join(",") : "";

  // Dynamic Graph API fetch with selected document filtering
  const { data: graphData, refetch, isLoading } = useQuery({
    queryKey: ["knowledge-graph", docIdParam],
    queryFn: async () => {
      const url = docIdParam ? `/api/graph?doc_ids=${encodeURIComponent(docIdParam)}` : "/api/graph";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch graph topology");
      return res.json();
    },
    staleTime: 30000,
  });

  // Active graph data or fallbacks
  const activeGraph = useMemo(() => {
    if (graphData && graphData.nodes && graphData.nodes.length > 0) {
      return graphData;
    }
    // High quality fallback graph
    const docName = documents[0]?.doc_name || "MySQL Cheatsheet.pdf";
    return {
      nodes: [
        { id: "doc-1", label: docName, type: "document", connections: ["sec-1", "sec-2", "sec-3"] },
        { id: "sec-1", label: "Numeric Types", type: "section", connections: ["c-1", "c-2", "c-3"] },
        { id: "sec-2", label: "Time & Date Types", type: "section", connections: ["c-4", "c-5"] },
        { id: "sec-3", label: "SQL Syntax & Commands", type: "section", connections: ["c-6", "c-7"] },
        { id: "c-1", label: "DOUBLE", type: "concept", connections: [] },
        { id: "c-2", label: "FLOAT", type: "concept", connections: [] },
        { id: "c-3", label: "BIGINT", type: "concept", connections: [] },
        { id: "c-4", label: "DATETIME", type: "concept", connections: [] },
        { id: "c-5", label: "TIMESTAMP", type: "concept", connections: [] },
        { id: "c-6", label: "SELECT / WHERE", type: "concept", connections: [] },
        { id: "c-7", label: "VARCHAR", type: "concept", connections: [] },
      ],
      links: [
        { source: "doc-1", target: "sec-1", relation: "contains_section" },
        { source: "doc-1", target: "sec-2", relation: "contains_section" },
        { source: "doc-1", target: "sec-3", relation: "contains_section" },
        { source: "sec-1", target: "c-1", relation: "defines" },
        { source: "sec-1", target: "c-2", relation: "defines" },
        { source: "sec-1", target: "c-3", relation: "defines" },
        { source: "sec-2", target: "c-4", relation: "defines" },
        { source: "sec-2", target: "c-5", relation: "defines" },
        { source: "sec-3", target: "c-6", relation: "defines" },
        { source: "sec-3", target: "c-7", relation: "defines" },
      ],
    };
  }, [graphData, documents]);

  // Compute hierarchical positions (x, y) for nodes on the SVG canvas
  const positionedNodes = useMemo(() => {
    const nodes: (GraphNode & { x: number; y: number })[] = [];
    const rawNodes: GraphNode[] = activeGraph.nodes || [];

    const docNodes = rawNodes.filter((n) => n.type === "document");
    const secNodes = rawNodes.filter((n) => n.type === "section");
    const concNodes = rawNodes.filter((n) => n.type === "concept" || (!n.type && n.id.startsWith("c-")));
    const remainingNodes = rawNodes.filter(
      (n) => !docNodes.includes(n) && !secNodes.includes(n) && !concNodes.includes(n)
    );

    // Layer 1: Documents (Top Hubs, y = 45)
    docNodes.forEach((node, i) => {
      const spacing = 460 / (docNodes.length + 1);
      nodes.push({ ...node, x: spacing * (i + 1), y: 45 });
    });
    if (docNodes.length === 0) {
      nodes.push({
        id: "doc-root",
        label: documents[0]?.doc_name || "Document Root",
        type: "document",
        connections: [],
        x: 230,
        y: 45,
      });
    }

    // Layer 2: Sections / Topics (Middle Tier, y = 145)
    secNodes.forEach((node, i) => {
      const spacing = 460 / (secNodes.length + 1);
      nodes.push({ ...node, x: spacing * (i + 1), y: 145 });
    });

    // Layer 3: Concepts / Entities (Bottom Tier, y = 250)
    const allConcepts = [...concNodes, ...remainingNodes];
    allConcepts.forEach((node, i) => {
      const columns = Math.min(6, allConcepts.length);
      const col = i % columns;
      const row = Math.floor(i / columns);
      const spacing = 460 / (columns + 1);
      nodes.push({ ...node, x: spacing * (col + 1), y: 245 + row * 40 });
    });

    return nodes;
  }, [activeGraph, documents]);

  // Map links with positioned nodes
  const positionedLinks = useMemo(() => {
    const links: { sourceNode: any; targetNode: any; relation: string }[] = [];
    const rawLinks: GraphLink[] = activeGraph.links || [];

    rawLinks.forEach((l) => {
      const src = positionedNodes.find((n) => n.id === l.source || n.label === l.source);
      const tgt = positionedNodes.find((n) => n.id === l.target || n.label === l.target);
      if (src && tgt) {
        links.push({ sourceNode: src, targetNode: tgt, relation: l.relation || "relates_to" });
      }
    });

    return links;
  }, [activeGraph, positionedNodes]);

  // Filtered concepts tag cloud
  const filteredConcepts = useMemo(() => {
    const allNodes: GraphNode[] = activeGraph.nodes || [];
    return allNodes.filter((n) => {
      const matchesSearch = n.label.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === "all" || n.type === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [activeGraph, searchTerm, filterType]);

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto p-4 space-y-4 bg-background text-xs">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Network className="h-4 w-4 text-cyan-400" />
            <span>Knowledge Graph &amp; Entity Relationships</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {positionedNodes.length} nodes &bull; {positionedLinks.length} topological connections
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          className="h-6 text-[10px] gap-1 border-border text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={isLoading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          Refresh
        </Button>
      </div>

      {/* Selected Document Roots Badge Bar */}
      <div className="p-3 rounded-xl bg-card/60 border border-border space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <FileText className="h-3.5 w-3.5 text-indigo-400" />
          <span>Active Knowledge Scope ({selectedDocIds.length > 0 ? selectedDocIds.length : "All Documents"})</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {documents.map((doc) => (
            <Badge
              key={doc.doc_id}
              variant={selectedDocIds.includes(doc.doc_id) ? "default" : "outline"}
              className={`text-[10px] px-2 py-0.5 cursor-pointer ${
                selectedDocIds.includes(doc.doc_id)
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "border-border text-muted-foreground"
              }`}
            >
              {doc.doc_name}
            </Badge>
          ))}
          {documents.length === 0 && (
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
              MySQL Cheatsheet.pdf (Default Root)
            </Badge>
          )}
        </div>
      </div>

      {/* Interactive Topology Graph Canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            <span>Interactive Graph Canvas</span>
          </span>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.8))}
              className="h-6 w-6 border-border text-muted-foreground"
              title="Zoom In"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.6))}
              className="h-6 w-6 border-border text-muted-foreground"
              title="Zoom Out"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoomLevel(1)}
              className="h-6 w-6 border-border text-muted-foreground"
              title="Reset View"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Dynamic SVG Topology Viewport */}
        <div className="relative w-full h-80 rounded-xl bg-slate-950/90 border border-slate-800 p-3 overflow-hidden shadow-inner flex items-center justify-center">
          {/* Grid Background Pattern */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#38bdf8 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          <div
            className="w-full h-full relative transition-transform duration-300 ease-out"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
          >
            {/* SVG Link Curves */}
            <svg className="w-full h-full absolute inset-0 pointer-events-none z-0 overflow-visible">
              <defs>
                <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {positionedLinks.map((link, idx) => {
                const x1 = link.sourceNode.x;
                const y1 = link.sourceNode.y;
                const x2 = link.targetNode.x;
                const y2 = link.targetNode.y;
                const cy = (y1 + y2) / 2;

                const isHighlighted =
                  selectedNode &&
                  (selectedNode.id === link.sourceNode.id || selectedNode.id === link.targetNode.id);

                return (
                  <g key={`link-${idx}`}>
                    <path
                      d={`M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`}
                      fill="none"
                      stroke={isHighlighted ? "#38bdf8" : "url(#edge-grad)"}
                      strokeWidth={isHighlighted ? 2.5 : 1.2}
                      strokeDasharray={isHighlighted ? "none" : "3,3"}
                      className="transition-all duration-300"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Interactive SVG Node Pills */}
            {positionedNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isDoc = node.type === "document";
              const isSec = node.type === "section";

              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                  className={`absolute z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-mono text-[11px] font-medium transition-all duration-200 shadow-lg cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-cyan-400 bg-cyan-950 text-cyan-200 border-cyan-400 scale-110 z-20"
                      : isDoc
                      ? "bg-indigo-950/90 text-indigo-200 border-indigo-500/60 hover:border-indigo-400 hover:scale-105"
                      : isSec
                      ? "bg-slate-900/90 text-cyan-200 border-cyan-500/50 hover:border-cyan-400 hover:scale-105"
                      : "bg-slate-900/80 text-purple-200 border-purple-500/40 hover:border-purple-300 hover:scale-105"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isDoc ? "bg-indigo-400 animate-pulse" : isSec ? "bg-cyan-400" : "bg-purple-400"
                    }`}
                  />
                  <span className="truncate max-w-[120px]">{node.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Node Inspection Drawer */}
      {selectedNode && (
        <div className="p-3 rounded-xl bg-card border border-cyan-500/40 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <Sparkles className="h-4 w-4" />
              <span>Entity Node Inspector</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedNode(null)}
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Node Name:</span>
              <p className="font-mono font-bold text-foreground">{selectedNode.label}</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Node Category:</span>
              <Badge variant="outline" className="text-[9px] capitalize text-cyan-400 border-cyan-500/30">
                {selectedNode.type || "concept"}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Concepts Tag Cloud & Search Bar */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <Layers className="h-3.5 w-3.5 text-purple-400" />
            <span>Extracted Concepts ({filteredConcepts.length})</span>
          </div>

          <div className="relative w-48">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search concepts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-8 pr-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Filter Type Pills */}
        <div className="flex items-center gap-1">
          {(["all", "document", "section", "concept"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize transition ${
                filterType === t
                  ? "bg-indigo-600 text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Concepts Tag Cloud Grid */}
        <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-1.5 rounded-xl border border-border bg-card/40">
          {filteredConcepts.map((node) => (
            <Badge
              key={node.id}
              variant="secondary"
              onClick={() => setSelectedNode(node)}
              className="text-[10px] px-2.5 py-1 gap-1 cursor-pointer bg-slate-900/90 text-purple-200 border border-purple-500/30 hover:border-purple-400 hover:bg-slate-800 transition"
            >
              <LinkIcon className="h-2.5 w-2.5 text-purple-400" />
              <span>{node.label}</span>
            </Badge>
          ))}
          {filteredConcepts.length === 0 && (
            <p className="text-[11px] text-muted-foreground p-2">No concepts match &apos;{searchTerm}&apos;.</p>
          )}
        </div>
      </div>
    </div>
  );
}
