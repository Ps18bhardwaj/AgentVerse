import { useState } from "react";
import {
  Activity,
  DollarSign,
  Cpu,
  Zap,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ObservabilityPanel() {
  const [metrics] = useState<any>({
    qdrant_status: "healthy",
    total_tokens_used: 184920,
    estimated_cost_usd: 0.0369,
    avg_latency_ms: 142.5,
    rag_grounding_score: 0.942,
    active_users: 12,
    total_documents: 8,
    total_chunks: 1420,
    models: {
      embedding: "BAAI/bge-large-en-v1.5",
      reranker: "BAAI/bge-reranker-large",
      llm: "gemini-2.0-flash",
    },
  });

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto p-4 space-y-4 bg-background text-xs">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span>Observability & Cost Analytics</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">OpenTelemetry, Langfuse tracing & Prometheus metrics</p>
        </div>

        <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-500/30 text-[9px]">
          Operational
        </Badge>
      </div>

      {/* Top Cards Grid in 2 columns to fit 520px nicely */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border bg-card/60">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground">RAG Accuracy</CardTitle>
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-base font-bold text-foreground">{(metrics.rag_grounding_score * 100).toFixed(1)}%</div>
            <p className="text-[9px] text-emerald-400 mt-0.5">Risk &lt; 0.05</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground">Avg Latency</CardTitle>
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-base font-bold text-foreground">{metrics.avg_latency_ms} ms</div>
            <p className="text-[9px] text-cyan-400 mt-0.5">p99: 210ms</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground">Total Tokens</CardTitle>
            <Layers className="h-3.5 w-3.5 text-purple-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-base font-bold text-foreground">{metrics.total_tokens_used.toLocaleString()}</div>
            <p className="text-[9px] text-muted-foreground mt-0.5">12 sessions</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground">Est. Cost</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-amber-400" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-base font-bold text-foreground">${metrics.estimated_cost_usd}</div>
            <p className="text-[9px] text-amber-400 mt-0.5">Rerank cached</p>
          </CardContent>
        </Card>
      </div>

      {/* Model Stack */}
      <Card className="border-border bg-card/60">
        <CardHeader className="py-2.5 px-3 border-b border-border">
          <CardTitle className="text-xs font-semibold text-foreground">AI Infrastructure Model Stack</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2.5">
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-background/50 border border-border">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Dense Embedding Model</span>
              <p className="font-mono text-xs font-bold text-foreground mt-0.5">{metrics.models.embedding}</p>
              <p className="text-[9px] text-emerald-400 mt-0.5">Dimension: 1024 (Cosine Similarity)</p>
            </div>
            <div className="p-2.5 rounded-lg bg-background/50 border border-border">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Cross-Encoder Reranker</span>
              <p className="font-mono text-xs font-bold text-foreground mt-0.5">{metrics.models.reranker}</p>
              <p className="text-[9px] text-emerald-400 mt-0.5">Stage 2 Re-scoring Active</p>
            </div>
            <div className="p-2.5 rounded-lg bg-background/50 border border-border">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Primary Generation LLM</span>
              <p className="font-mono text-xs font-bold text-foreground mt-0.5">{metrics.models.llm}</p>
              <p className="text-[9px] text-cyan-400 mt-0.5">LiteLLM Managed Router</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
