import { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Trash2,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useStore } from "@/store";

export function HumanInTheLoopPanel() {
  const approvalTasks = useStore((s) => s.approvalTasks);
  const resolveApprovalTask = useStore((s) => s.resolveApprovalTask);
  const deleteApprovalTask = useStore((s) => s.deleteApprovalTask);
  const clearApprovalTasks = useStore((s) => s.clearApprovalTasks);
  const addApprovalTask = useStore((s) => s.addApprovalTask);

  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state for adding custom approval task
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("Automation Agent");
  const [description, setDescription] = useState("");
  const [proposedAction, setProposedAction] = useState("");

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !proposedAction.trim()) {
      toast.error("Please provide a title and proposed action.");
      return;
    }
    addApprovalTask({
      source: source || "Custom Workflow",
      title: title.trim(),
      description: description.trim() || "Manual security approval gate",
      proposedAction: proposedAction.trim(),
      status: "pending",
    });
    toast.success("New approval request added to queue!");
    setTitle("");
    setDescription("");
    setProposedAction("");
    setShowAddForm(false);
  };

  const filteredTasks = approvalTasks.filter((t) => {
    if (activeTab === "pending") return t.status === "pending";
    if (activeTab === "approved") return t.status === "approved";
    if (activeTab === "rejected") return t.status === "rejected";
    return true;
  });

  const pendingCount = approvalTasks.filter((t) => t.status === "pending").length;

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto p-4 space-y-4 bg-background text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Human Approval Queue</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Approve, edit, or reject sensitive AI agent &amp; workflow execution steps
          </p>
        </div>

        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
          Zero-Trust Security Active
        </Badge>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-card/60 p-2 rounded-xl border border-border">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={activeTab === "all" ? "default" : "ghost"}
            onClick={() => setActiveTab("all")}
            className="h-6 text-[10px] px-2"
          >
            All ({approvalTasks.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "pending" ? "default" : "ghost"}
            onClick={() => setActiveTab("pending")}
            className="h-6 text-[10px] px-2 text-amber-400"
          >
            Pending ({pendingCount})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "approved" ? "default" : "ghost"}
            onClick={() => setActiveTab("approved")}
            className="h-6 text-[10px] px-2 text-emerald-400"
          >
            Approved
          </Button>
          <Button
            size="sm"
            variant={activeTab === "rejected" ? "default" : "ghost"}
            onClick={() => setActiveTab("rejected")}
            className="h-6 text-[10px] px-2 text-red-400"
          >
            Rejected
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(!showAddForm)}
            className="h-6 text-[10px] gap-1 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
          >
            <Plus className="h-3 w-3" />
            Add Task
          </Button>

          {approvalTasks.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearApprovalTasks();
                toast.success("Queue cleared.");
              }}
              className="h-6 text-[10px] text-muted-foreground hover:text-red-400"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Add Task Form */}
      {showAddForm && (
        <form onSubmit={handleCreateTask} className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-400 text-xs flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Request Human Approval Task
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)} className="h-5 text-[10px]">
              Cancel
            </Button>
          </div>
          <input
            type="text"
            placeholder="Action Title (e.g. Execute SQL Migration Script)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Source (e.g. Automation Agent)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Proposed Action (e.g. db_drop: users)"
              value={proposedAction}
              onChange={(e) => setProposedAction(e.target.value)}
              className="bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
          <input
            type="text"
            placeholder="Description / Context"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-emerald-500"
          />
          <Button type="submit" size="sm" className="w-full h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
            Add Approval Task to Queue
          </Button>
        </form>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.map((t) => (
          <Card key={t.id} className="border-border bg-card/60 relative group">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-1.5 min-w-0 pr-6">
                <Badge variant="secondary" className="text-[9px] bg-slate-800 text-slate-300">
                  {t.source}
                </Badge>
                <h3 className="font-semibold text-xs text-foreground truncate">{t.title}</h3>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge
                  variant={
                    t.status === "pending"
                      ? "outline"
                      : t.status === "approved"
                      ? "default"
                      : "destructive"
                  }
                  className={`text-[9px] ${
                    t.status === "pending"
                      ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                      : t.status === "approved"
                      ? "bg-emerald-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  {t.status}
                </Badge>

                {/* Delete Task Trash Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    deleteApprovalTask(t.id);
                    toast.success("Approval task removed");
                  }}
                  className="h-6 w-6 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 opacity-70 group-hover:opacity-100 transition"
                  title="Delete task from queue"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-2">
              <p className="text-[11px] text-muted-foreground">{t.description}</p>
              <div className="p-2 rounded bg-black/50 border border-border text-[10px] font-mono text-emerald-400 break-all">
                Proposed Action: {t.proposedAction}
              </div>
              {t.status === "pending" && (
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resolveApprovalTask(t.id, "rejected");
                      toast.error(`Task '${t.title}' rejected.`);
                    }}
                    className="h-7 text-[10px] text-red-400 border-red-500/30 hover:bg-red-500/10"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      resolveApprovalTask(t.id, "approved");
                      toast.success(`Task '${t.title}' approved & executed!`);
                    }}
                    className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approve Action
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredTasks.length === 0 && (
          <div className="p-8 text-center border border-dashed border-border rounded-xl space-y-1">
            <p className="text-muted-foreground text-xs">No approval tasks found in this view.</p>
            <p className="text-[10px] text-muted-foreground">
              Tapping @automation or sensitivity actions in chat automatically queues tasks here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
