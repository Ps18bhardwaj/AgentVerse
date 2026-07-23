import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Pin,
  ThumbsUp,
  ThumbsDown,
  Bot,
  Clock,
  CheckCircle2,
  Network,
  Shield,
  XCircle,
  Paperclip,
} from "lucide-react";
import { useStore, type ChatMessage } from "@/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CitationChip } from "./CitationChip";
import { RetrievalInspector } from "./RetrievalInspector";
import { remarkCitations } from "@/lib/remarkCitations";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function stableMarkdown(text: string, streaming?: boolean): string {
  if (!streaming) return text;
  const fences = (text.match(/```/g) ?? []).length;
  return fences % 2 === 1 ? `${text}\n\`\`\`` : text;
}

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const openViewer = useStore((s) => s.openViewer);
  const pinnedMessageIds = useStore((s) => s.pinnedMessageIds);
  const togglePinMessage = useStore((s) => s.togglePinMessage);
  const setRightPanelMode = useStore((s) => s.setRightPanelMode);
  const updateMessage = useStore((s) => s.updateMessage);

  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);

  const isPinned = pinnedMessageIds.includes(msg.id);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApproval = (action: "approved" | "rejected") => {
    if (msg.approvalTask) {
      updateMessage(msg.id, {
        approvalTask: { ...msg.approvalTask, status: action },
      });
      toast.success(`Action '${action}' for task ${msg.approvalTask.id}`);
    }
  };

  const onCite = (n: number) => {
    const c = msg.citations?.find((c) => c.marker === n);
    if (c && c.source_type === "pdf") {
      openViewer({
        docId: c.doc_id,
        docName: c.doc_name,
        page: c.page,
        snippet: c.snippet,
      });
    } else {
      document
        .getElementById(`citation-${msg.id}-${n}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const components = useMemo(
    () => ({
      cite: (props: any) => (
        <CitationChip marker={Number(props["data-marker"])} onCite={onCite} />
      ),
      a: (props: any) => (
        <a {...props} target="_blank" rel="noreferrer" className="text-indigo-400 underline" />
      ),
      code({ node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || "");
        return !inline ? (
          <div className="relative my-2 rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-xs overflow-x-auto text-emerald-300">
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
              <span>{match ? match[1] : "code"}</span>
              <button
                onClick={() => navigator.clipboard.writeText(String(children))}
                className="hover:text-slate-200 flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <code {...props}>{children}</code>
          </div>
        ) : (
          <code className="bg-slate-800/80 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-xs" {...props}>
            {children}
          </code>
        );
      },
    }),
    [msg.citations, msg.id]
  );

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {/* Render Attached Files Pills if present (ChatGPT / Gemini style) */}
        {msg.attachedFiles && msg.attachedFiles.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5 max-w-[80%]">
            {msg.attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-indigo-500/40 text-xs text-foreground shadow-sm"
              >
                <Paperclip className="h-3.5 w-3.5 text-indigo-400" />
                <span className="font-semibold text-xs truncate max-w-[180px]">{file.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-medium text-white shadow-md">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 group">
      {/* Inline Agent Reasoning Timeline */}
      {msg.agentSteps && msg.agentSteps.length > 0 && (
        <Card className="max-w-[85%] border-purple-500/30 bg-purple-950/10 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-300 flex items-center gap-1.5 text-[11px]">
              <Bot className="h-3.5 w-3.5 text-purple-400" />
              Agent Execution & Reasoning Trace
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRightPanelMode("agent")}
              className="h-6 text-[10px] text-purple-400 hover:text-purple-300"
            >
              Open Live Log →
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
            {msg.agentSteps.map((step, idx) => (
              <div
                key={`step-${step.step_index}-${idx}`}
                className="flex items-center gap-1.5 p-1.5 rounded bg-card/60 border border-border text-[10px]"
              >

                {step.status === "completed" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="h-3 w-3 text-amber-400 animate-spin shrink-0" />
                )}
                <span className="truncate font-medium text-foreground">{step.title}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Inline Human Approval Card */}
      {msg.approvalTask && (
        <Card className="max-w-[85%] border-amber-500/40 bg-amber-950/10 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px]">
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              Human Approval Required Before Execution
            </span>
            <Badge
              variant={
                msg.approvalTask.status === "pending"
                  ? "outline"
                  : msg.approvalTask.status === "approved"
                  ? "default"
                  : "destructive"
              }
              className="text-[9px]"
            >
              {msg.approvalTask.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-[11px]">{msg.approvalTask.description}</p>
          <div className="p-2 rounded bg-black/40 font-mono text-[10px] text-amber-400">
            Action: {msg.approvalTask.proposedAction}
          </div>
          {msg.approvalTask.status === "pending" && (
            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApproval("rejected")}
                className="h-7 text-[10px] text-red-400 border-red-500/30 hover:bg-red-500/10"
              >
                <XCircle className="h-3 w-3 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                onClick={() => handleApproval("approved")}
                className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve Action
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Assistant Main Bubble */}
      <Card
        className={cn(
          "max-w-[85%] px-4 py-3 relative transition-all border-border bg-card/80 backdrop-blur-md",
          isPinned && "border-amber-500/40 bg-amber-500/5"
        )}
      >
        <div className="prose-chat text-xs leading-relaxed text-foreground">
          {msg.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkCitations]} components={components}>
              {stableMarkdown(msg.content, msg.streaming)}
            </ReactMarkdown>
          ) : (
            msg.streaming && <span className="text-indigo-400 animate-pulse">Thinking…</span>
          )}
        </div>

        {!msg.streaming && msg.content && (
          <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              {msg.grounded ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" /> Grounded in sources
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 font-medium">
                  <ShieldAlert className="h-3.5 w-3.5" /> General answer
                </span>
              )}

              <button
                onClick={() => setRightPanelMode("graph")}
                className="flex items-center gap-1 text-cyan-400 hover:underline font-medium ml-2"
              >
                <Network className="h-3 w-3" /> Graph Entities
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                title="Copy message"
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => togglePinMessage(msg.id)}
                title={isPinned ? "Unpin message" : "Pin message"}
                className={cn(
                  "p-1 rounded hover:bg-accent",
                  isPinned ? "text-amber-400" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setLiked(liked === true ? null : true)}
                title="Helpful"
                className={cn(
                  "p-1 rounded hover:bg-accent",
                  liked === true ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setLiked(liked === false ? null : false)}
                title="Not helpful"
                className={cn(
                  "p-1 rounded hover:bg-accent",
                  liked === false ? "text-red-400" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {!msg.streaming && msg.trace && <RetrievalInspector trace={msg.trace} />}

      {/* Citation Sources */}
      {msg.citations && msg.citations.length > 0 && (
        <div className="flex max-w-[85%] flex-col gap-1.5">
          {msg.citations.map((c) => (
            <div
              key={c.marker}
              id={`citation-${msg.id}-${c.marker}`}
              role="button"
              tabIndex={0}
              onClick={() =>
                c.source_type === "pdf" &&
                openViewer({
                  docId: c.doc_id,
                  docName: c.doc_name,
                  page: c.page,
                  snippet: c.snippet,
                })
              }
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLElement).click()}
              className={cn(
                "rounded-md border border-border bg-card/60 px-3 py-2 text-xs transition-colors",
                c.source_type === "pdf" && "cursor-pointer hover:bg-accent/70"
              )}
            >
              <div className="flex items-center gap-1.5 font-medium">
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                  {c.marker}
                </span>
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{c.doc_name}</span>
                <span className="text-muted-foreground">
                  · {c.source_type === "pdf" ? "page" : "part"} {c.page}
                </span>
                {c.section && <span className="truncate text-muted-foreground">· {c.section}</span>}
              </div>
              <p className="mt-1 text-muted-foreground text-[11px]">{c.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
