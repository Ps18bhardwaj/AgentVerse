import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SendHorizonal,
  Sparkles,
  Square,
  Bot,
  GitFork,
  Network,
  Shield,
  Mic,
  Paperclip,
  Loader2,
  FileText,
  X,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { askStream, runAgentStream, listDocuments, uploadDocuments, type ChatTurn } from "@/lib/api";
import { useActiveMessages, useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "./MessageBubble";

let idSeq = 0;
const nextId = () => `m${++idSeq}-${Date.now()}`;

const QUICK_COMMANDS = [
  { label: "Research Agent", tag: "@research", icon: Bot },
  { label: "Coding Agent", tag: "@coding", icon: Bot },
  { label: "Executive Writing", tag: "@writing", icon: Bot },
  { label: "Multi-Step Workflow", tag: "@workflow", icon: GitFork },
  { label: "Entity Knowledge Graph", tag: "@graph", icon: Network },
  { label: "Human Review Queue", tag: "@approval", icon: Shield },
];

const SAMPLES = [
  "Research key architectural decisions and generate executive summary.",
  "Summarize every document, create Notion page, and dispatch email brief.",
  "Identify entities across documents and map Knowledge Graph relationships.",
];

const AGENT_TAG_MAP: Record<string, string> = {
  "@research": "research",
  "@coding": "coding",
  "@writing": "writing",
  "@analysis": "analysis",
  "@planning": "planning",
  "@document": "document",
  "@github": "github",
  "@email": "email",
  "@automation": "automation",
  "@meeting": "meeting",
  "@knowledge": "knowledge",
};

interface DraftAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  status: "uploading" | "ready" | "error";
  docId?: string;
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const {
    addMessage,
    updateMessage,
    appendToken,
    selectedDocIds,
    setRightPanelMode,
    setActiveAgentTask,
    setVoiceOpen,
  } = useStore();
  const messages = useActiveMessages();

  const { data: docs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  const samples = useMemo(() => {
    const pool = (
      selectedDocIds.length
        ? docs.filter((d) => selectedDocIds.includes(d.doc_id))
        : docs
    ).flatMap((d) => d.suggested_questions ?? []);
    const unique = [...new Set(pool)];
    return unique.length ? unique.slice(0, 3) : SAMPLES;
  }, [docs, selectedDocIds]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    const newDrafts: DraftAttachment[] = fileArray.map((f) => ({
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      name: f.name,
      size: f.size,
      status: "uploading",
    }));

    setDraftAttachments((prev) => [...prev, ...newDrafts]);

    try {
      await uploadDocuments(fileArray);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(`${fileArray.length} document(s) uploaded and indexed!`);
      setDraftAttachments((prev) =>
        prev.map((d) => (newDrafts.some((nd) => nd.id === d.id) ? { ...d, status: "ready" } : d))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to index document");
      setDraftAttachments((prev) =>
        prev.map((d) => (newDrafts.some((nd) => nd.id === d.id) ? { ...d, status: "error" } : d))
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setDraftAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  async function send(question: string) {
    const q = question.trim();
    if ((!q && draftAttachments.length === 0) || busy) return;
    const currentAttachments = [...draftAttachments];
    setInput("");
    setDraftAttachments([]);
    setBusy(true);

    const promptText = q || `Analyzed attached documents: ${currentAttachments.map((a) => a.name).join(", ")}`;
    const lowerQ = promptText.toLowerCase();

    let matchedAgentType: string | null = null;
    for (const [tag, type] of Object.entries(AGENT_TAG_MAP)) {
      if (lowerQ.includes(tag) || lowerQ.startsWith(type)) {
        matchedAgentType = type;
        break;
      }
    }

    const attachedMeta = currentAttachments.map((a) => ({
      id: a.id,
      name: a.name,
      size: a.size,
    }));

    addMessage({
      id: nextId(),
      role: "user",
      content: promptText,
      attachedFiles: attachedMeta.length ? attachedMeta : undefined,
    });

    const assistantId = nextId();

    if (matchedAgentType) {
      setRightPanelMode("agent");
      addMessage({
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        agentSteps: [
          { step_index: 1, title: "Task Decomposition", status: "running" },
        ],
      });

      abortRef.current = new AbortController();
      let accumulatedSteps: any[] = [
        { step_index: 1, title: "Task Decomposition", status: "completed" },
      ];

      await runAgentStream(
        matchedAgentType,
        promptText,
        selectedDocIds.length ? selectedDocIds : null,
        {
          onStepStart: (data) => {
            const step = { step_index: data.step_index, title: data.title, status: "running", thought: data.thought };
            accumulatedSteps.push(step);
            updateMessage(assistantId, { agentSteps: [...accumulatedSteps] });
            setActiveAgentTask({ agent_type: matchedAgentType, prompt: promptText, steps: accumulatedSteps });
          },
          onStepUpdate: (data) => {
            accumulatedSteps = accumulatedSteps.map((s) =>
              s.step_index === data.step_index ? { ...s, status: "completed", thought: data.thought } : s
            );
            updateMessage(assistantId, { agentSteps: [...accumulatedSteps] });
            setActiveAgentTask({ agent_type: matchedAgentType, prompt: promptText, steps: accumulatedSteps });
          },
          onCompleted: (data) => {
            updateMessage(assistantId, {
              content: data.result,
              agentSteps: data.steps || accumulatedSteps,
              streaming: false,
              grounded: true,
            });
            setActiveAgentTask({ agent_type: matchedAgentType, prompt: promptText, steps: data.steps });
          },
          onError: (err) => {
            toast.error(err.message);
            updateMessage(assistantId, {
              content: `⚠️ Agent execution error: ${err.message}`,
              streaming: false,
              grounded: false,
            });
          },
        },
        abortRef.current.signal
      );

      updateMessage(assistantId, { streaming: false });
      setBusy(false);
      return;
    }

    let inlineApproval: any | undefined = undefined;
    if (lowerQ.includes("@workflow") || lowerQ.includes("workflow") || lowerQ.includes("notion")) {
      setRightPanelMode("human_loop");
      inlineApproval = {
        id: `appr-${Date.now().toString().slice(-4)}`,
        title: "Workflow Action: Create Notion Page & Email Brief",
        description: "Post executive PDF summary to Notion wiki and dispatch email alert",
        proposedAction: "notion.createPage(title='AI Digest') | mail.send(to='manager@company.com')",
        status: "pending",
      };
    } else if (lowerQ.includes("@graph") || lowerQ.includes("entity") || lowerQ.includes("graph")) {
      setRightPanelMode("graph");
    } else if (lowerQ.includes("@connectors") || lowerQ.includes("github") || lowerQ.includes("slack")) {
      setRightPanelMode("connectors");
    } else if (lowerQ.includes("@telemetry") || lowerQ.includes("cost") || lowerQ.includes("latency")) {
      setRightPanelMode("telemetry");
    }

    const history: ChatTurn[] = messages
      .filter((m) => m.content && !m.streaming)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    addMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
      approvalTask: inlineApproval,
    });

    abortRef.current = new AbortController();
    await askStream(
      {
        question: promptText,
        doc_ids: selectedDocIds.length ? selectedDocIds : null,
        history: history.length ? history : undefined,
        include_trace: true,
      },
      {
        onMeta: (meta) => updateMessage(assistantId, { meta }),
        onSources: (sources) => updateMessage(assistantId, { sources }),
        onTrace: (trace) => updateMessage(assistantId, { trace }),
        onToken: (t) => appendToken(assistantId, t),
        onDone: ({ grounded, citations }) =>
          updateMessage(assistantId, { grounded, citations, streaming: false }),
        onError: (err) => {
          toast.error(err.message);
          updateMessage(assistantId, {
            content: `⚠️ ${err.message}`,
            streaming: false,
            grounded: false,
          });
        },
      },
      abortRef.current.signal
    );

    updateMessage(assistantId, { streaming: false });
    setBusy(false);
  }

  return (
    <main
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFilesPicked(e.dataTransfer.files);
      }}
      className="flex h-full min-w-0 flex-1 flex-col bg-background relative"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-950/80 backdrop-blur-md flex flex-col items-center justify-center text-white border-2 border-dashed border-indigo-400 m-4 rounded-2xl animate-in fade-in">
          <Paperclip className="h-12 w-12 text-indigo-400 animate-bounce mb-2" />
          <h2 className="text-lg font-bold">Drop files here to upload & index</h2>
          <p className="text-xs text-indigo-300">PDF, DOCX, and TXT files will be chunked into Qdrant vector storage</p>
        </div>
      )}

      {/* Hidden File Input Picker */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFilesPicked(e.target.files)}
        multiple
        accept=".pdf,.docx,.txt"
        className="hidden"
      />

      {/* Messages Stream Container */}
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-6 py-6 max-w-4xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="mx-auto mt-12 max-w-lg text-center space-y-4 select-none">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                AgentVerse Conversational AI Workspace

              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Ask questions, dispatch AI agents, run visual workflows, or upload documents directly into chat.
              </p>
            </div>

            {/* Quick Command Pills */}
            <div className="flex flex-wrap justify-center gap-1.5 pt-2">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd.tag}
                  onClick={() => setInput((prev) => `${cmd.tag} ${prev}`)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-card/60 text-[11px] font-medium text-muted-foreground hover:border-indigo-500/40 hover:text-foreground transition-all"
                >
                  <span className="text-indigo-400 font-bold">{cmd.tag}</span>
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>

            {/* Suggested Starter Prompts */}
            <div className="mt-4 flex flex-col gap-2">
              {samples.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-border/80 bg-card/40 px-3.5 py-2.5 text-xs text-muted-foreground hover:border-indigo-500/40 hover:bg-card hover:text-foreground transition-all text-left flex items-center justify-between"
                >
                  <span>{s}</span>
                  <span className="text-indigo-400 font-bold">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Composer Box */}
      <div className="border-t border-border px-6 py-4 bg-card/30">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Active Status Bar above input */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              {selectedDocIds.length > 0 && (
                <Badge className="bg-indigo-600/20 text-indigo-300 border-indigo-500/30 text-[10px]">
                  Scoped to {selectedDocIds.length} file(s)
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRightPanelMode("document")}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium"
              >
                <FileText className="h-3.5 w-3.5 text-indigo-400" />
                <span>Documents Repository ({docs.length})</span>
              </button>
              <button
                onClick={() => setVoiceOpen(true)}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <Mic className="h-3.5 w-3.5" />
                <span>Voice Mode</span>
              </button>
            </div>
          </div>

          {/* ChatGPT / Gemini Style Composer Container */}
          <div className="rounded-2xl border border-border bg-card p-2 shadow-lg focus-within:ring-2 focus-within:ring-indigo-500 transition-all space-y-2">
            {/* Draft File Attachment Pills inside Composer */}
            {draftAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2 pt-1">
                {draftAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 p-2 rounded-xl bg-indigo-950/30 border border-indigo-500/40 text-xs font-medium text-foreground group"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 max-w-[160px]">
                      <p className="truncate text-xs font-semibold">{att.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(att.size / 1024).toFixed(0)} KB ·{" "}
                        {att.status === "uploading" ? (
                          <span className="text-amber-400 inline-flex items-center gap-0.5">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Ingesting
                          </span>
                        ) : (
                          <span className="text-emerald-400 inline-flex items-center gap-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Indexed
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="p-1 hover:text-red-400 text-muted-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              {/* Paperclip (+) Upload Button */}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                title="Upload PDF, DOCX, or TXT document"
                className="h-10 w-10 shrink-0 rounded-xl text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300"
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              <textarea
                id="composer"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask anything, attach files (📎), dispatch @agent, or run @workflow..."
                className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-xs text-foreground outline-none border-none placeholder:text-muted-foreground"
              />

              {busy ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Stop generating"
                  onClick={() => abortRef.current?.abort()}
                  className="h-10 w-10 shrink-0 rounded-xl"
                >
                  <Square className="h-4 w-4 text-red-400" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() && draftAttachments.length === 0}
                  className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md"
                >
                  <SendHorizonal className="h-4 w-4" />
                </Button>
              )}
            </form>
          </div>

          <p className="text-center text-[10px] text-muted-foreground">
            AgentVerse Enterprise AI — Drag & drop files or click 📎 to attach documents like ChatGPT & Gemini.

          </p>
        </div>
      </div>
    </main>
  );
}
