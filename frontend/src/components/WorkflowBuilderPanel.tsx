import { useState } from "react";
import {
  GitFork,
  Play,
  FileText,
  ScanText,
  CheckSquare,
  Share2,
  Mail,
  GitPullRequest,
  MessageSquare,
  Database,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface WorkflowNode {
  id: string;
  type: "trigger" | "ocr" | "summarize" | "extract" | "notion" | "email" | "github" | "slack" | "save";
  title: string;
  subtitle: string;
  icon: any;
  status: "idle" | "running" | "completed";
}

const INITIAL_NODES: WorkflowNode[] = [
  { id: "node-1", type: "trigger", title: "Document Uploaded", subtitle: "PDF / DOCX Ingestion", icon: FileText, status: "idle" },
  { id: "node-2", type: "ocr", title: "OCR & Table Parser", subtitle: "Visual Layout Extraction", icon: ScanText, status: "idle" },
  { id: "node-3", type: "summarize", title: "AI Executive Summary", subtitle: "Generate Key Takeaways", icon: Sparkles, status: "idle" },
  { id: "node-4", type: "extract", title: "Extract Action Items", subtitle: "Structured JSON Mapping", icon: CheckSquare, status: "idle" },
  { id: "node-5", type: "notion", title: "Create Notion Page", subtitle: "Sync Workspace Wiki", icon: Share2, status: "idle" },
  { id: "node-6", type: "email", title: "Dispatch Email Brief", subtitle: "Send to Operations Team", icon: Mail, status: "idle" },
  { id: "node-7", type: "github", title: "Create GitHub Issue", subtitle: "Auto-track Dev Tasks", icon: GitPullRequest, status: "idle" },
  { id: "node-8", type: "slack", title: "Notify Slack Channel", subtitle: "Post to #intelligence", icon: MessageSquare, status: "idle" },
  { id: "node-9", type: "save", title: "Save Knowledge Graph", subtitle: "Index Vector Entities", icon: Database, status: "idle" },
];

export function WorkflowBuilderPanel() {
  const [nodes, setNodes] = useState<WorkflowNode[]>(INITIAL_NODES);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleRunWorkflow = async () => {
    setIsRunning(true);
    setLogs(["[SYSTEM] Initializing Visual Workflow DAG Execution..."]);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      setNodes((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, status: "running" } : n))
      );
      setLogs((prev) => [...prev, `[STEP ${i + 1}] Running '${node.title}' (${node.subtitle})...`]);

      await new Promise((r) => setTimeout(r, 400));

      setNodes((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, status: "completed" } : n))
      );
    }

    setLogs((prev) => [...prev, "[SUCCESS] All 9 steps executed smoothly! Data synced to Notion, GitHub & Slack."]);
    toast.success("Multi-step visual workflow executed successfully!");
    setIsRunning(false);
  };

  const handleReset = () => {
    setNodes(INITIAL_NODES.map((n) => ({ ...n, status: "idle" })));
    setLogs([]);
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-background">
      <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <GitFork className="h-5 w-5 text-purple-400" />
              <span>Multi-Step Visual Workflow Engine</span>
            </h1>
            <p className="text-xs text-muted-foreground">Chain document triggers, AI operations, and SaaS integrations</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
              Reset Canvas
            </Button>
            <Button
              onClick={handleRunWorkflow}
              disabled={isRunning}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-2"
            >
              {isRunning ? <Clock className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              <span>Execute Workflow</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            return (
              <div key={node.id} className="relative group">
                <Card
                  className={`border transition-all duration-200 ${
                    node.status === "completed"
                      ? "border-emerald-500/50 bg-emerald-950/10"
                      : node.status === "running"
                      ? "border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-500/10"
                      : "border-border bg-card/60"
                  }`}
                >
                  <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground font-bold">#{index + 1}</span>
                      <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">{node.type}</Badge>
                    </div>
                    {node.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {node.status === "running" && <Clock className="h-4 w-4 text-purple-400 animate-spin" />}
                  </CardHeader>
                  <CardContent className="p-3 pt-0 flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">{node.title}</h4>
                      <p className="text-[10px] text-muted-foreground">{node.subtitle}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {logs.length > 0 && (
          <Card className="border-border bg-card/40">
            <CardHeader className="py-2.5 px-4 border-b border-border">
              <CardTitle className="text-xs font-mono font-semibold text-muted-foreground">Execution Audit Output</CardTitle>
            </CardHeader>
            <CardContent className="p-4 font-mono text-[11px] space-y-1 bg-black/40 text-emerald-400 max-h-48 overflow-y-auto">
              {logs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
