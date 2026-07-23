import { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Task {
  id: string;
  source: string;
  title: string;
  description: string;
  proposedAction: string;
  status: "pending" | "approved" | "rejected";
}

const INITIAL_TASKS: Task[] = [
  {
    id: "appr-101",
    source: "Automation Agent",
    title: "Dispatch Executive Weekly Summary Email",
    description: "Send compiled PDF metrics report to c-suite@company.com",
    proposedAction: "email_to: c-suite@company.com | subject: Weekly AI Digest",
    status: "pending",
  },
  {
    id: "appr-102",
    source: "GitHub Workflow Node",
    title: "Publish Release v2.4 Tag to Main Repository",
    description: "Create release branch and push tag to production repository",
    proposedAction: "repo: acme/agentverse | tag: v2.4.0",

    status: "pending",
  },
];

export function HumanInTheLoopPanel() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);

  const handleResolve = (id: string, action: "approved" | "rejected") => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: action } : t))
    );
    toast.success(`Action '${action}' for task ${id}`);
  };

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto p-4 space-y-4 bg-background text-xs">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Human Approval Queue</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">Approve, edit, or reject sensitive AI agent & workflow execution steps</p>
        </div>

        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
          Zero-Trust Security Active
        </Badge>
      </div>

      <div className="space-y-3">
        {tasks.map((t) => (
          <Card key={t.id} className="border-border bg-card/60">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <Badge variant="secondary" className="text-[9px]">{t.source}</Badge>
                <h3 className="font-semibold text-xs text-foreground truncate">{t.title}</h3>
              </div>
              <Badge
                variant={t.status === "pending" ? "outline" : t.status === "approved" ? "default" : "destructive"}
                className="text-[9px] shrink-0"
              >
                {t.status}
              </Badge>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-2">
              <p className="text-[11px] text-muted-foreground">{t.description}</p>
              <div className="p-2 rounded bg-black/40 border border-border text-[10px] font-mono text-emerald-400 break-all">
                Proposed Action: {t.proposedAction}
              </div>
              {t.status === "pending" && (
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolve(t.id, "rejected")}
                    className="h-7 text-[10px] text-red-400 border-red-500/30 hover:bg-red-500/10"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleResolve(t.id, "approved")}
                    className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approve Action
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
