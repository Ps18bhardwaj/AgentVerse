import { Suspense, lazy } from "react";
import { X, Network, Plug, Shield, Activity, Settings, FileText, Bot } from "lucide-react";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KnowledgeGraphPanel } from "./KnowledgeGraphPanel";
import { ConnectorsPanel } from "./ConnectorsPanel";
import { HumanInTheLoopPanel } from "./HumanInTheLoopPanel";
import { ObservabilityPanel } from "./ObservabilityPanel";
import { SettingsPanel } from "./SettingsPanel";

const PdfViewerPanel = lazy(() =>
  import("./PdfViewerPanel").then((m) => ({
    default: m.PdfViewerPanel,
  }))
);

const ViewerFallback = () => (
  <div className="space-y-3 p-4">
    <Skeleton className="h-[500px] w-full" />
  </div>
);

export function RightContextualPanel() {
  const rightPanelMode = useStore((s) => s.rightPanelMode);
  const setRightPanelMode = useStore((s) => s.setRightPanelMode);
  const activeAgentTask = useStore((s) => s.activeAgentTask);

  if (rightPanelMode === "closed") return null;

  return (
    <aside className="w-[520px] shrink-0 border-l border-border bg-card/80 backdrop-blur-xl flex flex-col h-full overflow-hidden shadow-2xl z-20">
      {/* Header Bar */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border bg-card/40 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          {rightPanelMode === "document" && (
            <>
              <FileText className="h-4 w-4 text-indigo-400" />
              <span>Document Inspector & PDF Viewer</span>
            </>
          )}
          {rightPanelMode === "graph" && (
            <>
              <Network className="h-4 w-4 text-cyan-400" />
              <span>Knowledge Graph & Entity Relationships</span>
            </>
          )}
          {rightPanelMode === "agent" && (
            <>
              <Bot className="h-4 w-4 text-purple-400" />
              <span>Live Agent Execution Timeline</span>
            </>
          )}
          {rightPanelMode === "connectors" && (
            <>
              <Plug className="h-4 w-4 text-indigo-400" />
              <span>SaaS Integrations & Connectors</span>
            </>
          )}
          {rightPanelMode === "human_loop" && (
            <>
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Human Approval Queue</span>
            </>
          )}
          {rightPanelMode === "telemetry" && (
            <>
              <Activity className="h-4 w-4 text-purple-400" />
              <span>Observability & Cost Metrics</span>
            </>
          )}
          {rightPanelMode === "settings" && (
            <>
              <Settings className="h-4 w-4 text-amber-400" />
              <span>Workspace Settings & RBAC</span>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setRightPanelMode("closed")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Dynamic Content Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {rightPanelMode === "document" && (
          <Suspense fallback={<ViewerFallback />}>
            <PdfViewerPanel />
          </Suspense>
        )}
        {rightPanelMode === "graph" && <KnowledgeGraphPanel />}
        {rightPanelMode === "agent" && <AgentTaskLog task={activeAgentTask} />}
        {rightPanelMode === "connectors" && <ConnectorsPanel />}
        {rightPanelMode === "human_loop" && <HumanInTheLoopPanel />}
        {rightPanelMode === "telemetry" && <ObservabilityPanel />}
        {rightPanelMode === "settings" && <SettingsPanel />}
      </div>
    </aside>
  );
}

function AgentTaskLog({ task }: { task: any }) {
  if (!task) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
        <Bot className="h-8 w-8 mx-auto text-purple-400 opacity-60" />
        <p className="font-semibold text-foreground">No active agent task running.</p>
        <p>Type prompts like <code className="text-purple-400">@research</code> or <code className="text-purple-400">@coding</code> in chat to launch agent reasoning.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 text-xs">
      <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/30">
        <span className="font-bold text-purple-300">{task.agent_type?.toUpperCase()} AGENT TASK</span>
        <p className="text-muted-foreground mt-1">{task.prompt}</p>
      </div>

      <div className="space-y-2 font-mono text-[11px]">
        {task.steps?.map((step: any, i: number) => (
          <div key={i} className="p-2 rounded bg-background border border-border">
            <span className="text-emerald-400 font-bold">[{step.title}]</span>
            <p className="text-muted-foreground mt-0.5">{step.thought}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
