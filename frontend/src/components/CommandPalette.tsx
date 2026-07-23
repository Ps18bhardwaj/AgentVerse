import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { useQuery } from "@tanstack/react-query";
import { listDocuments } from "@/lib/api";
import {
  Search,
  FileText,
  MessageSquare,
  Network,
  BarChart3,
  Plus,
  Moon,
  Sun,
  X,
  Plug,
} from "lucide-react";

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setRightPanelMode,
    newSession,
    sessions,
    switchSession,
    theme,
    setTheme,
  } = useStore();

  const [query, setQuery] = useState("");

  const { data: docs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: listDocuments,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const sessionList = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);

  const filteredDocs = docs.filter((d) =>
    d.doc_name.toLowerCase().includes(query.toLowerCase())
  );
  const filteredSessions = sessionList.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase())
  );

  const executeAction = (action: () => void) => {
    action();
    setCommandPaletteOpen(false);
    setQuery("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden text-foreground divide-y divide-border">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 gap-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            autoFocus
            placeholder="Search conversations, documents, inspectors... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder-muted-foreground text-xs font-medium"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-4 text-xs">
          {/* Actions */}
          <div>
            <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Actions & Inspectors
            </div>
            <div className="space-y-1 mt-1">
              <button
                onClick={() => executeAction(() => newSession())}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl hover:bg-indigo-500/10 hover:text-indigo-400 text-foreground transition-colors text-left"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                New Conversation
              </button>
              <button
                onClick={() => executeAction(() => setRightPanelMode("graph"))}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl hover:bg-cyan-500/10 hover:text-cyan-400 text-foreground transition-colors text-left"
              >
                <Network className="w-4 h-4 text-cyan-400" />
                Inspect Knowledge Graph
              </button>
              <button
                onClick={() => executeAction(() => setRightPanelMode("connectors"))}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl hover:bg-purple-500/10 hover:text-purple-400 text-foreground transition-colors text-left"
              >
                <Plug className="w-4 h-4 text-purple-400" />
                SaaS Integration Connectors
              </button>
              <button
                onClick={() => executeAction(() => setRightPanelMode("telemetry"))}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl hover:bg-emerald-500/10 hover:text-emerald-400 text-foreground transition-colors text-left"
              >
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Observability & Cost Metrics
              </button>
              <button
                onClick={() => executeAction(() => setTheme(theme === "dark" ? "light" : "dark"))}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl hover:bg-amber-500/10 hover:text-amber-400 text-foreground transition-colors text-left"
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-amber-400" />}
                Toggle Theme ({theme})
              </button>
            </div>
          </div>

          {/* Document Search */}
          {filteredDocs.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Indexed Documents ({filteredDocs.length})
              </div>
              <div className="space-y-1 mt-1">
                {filteredDocs.map((doc) => (
                  <button
                    key={doc.doc_id}
                    onClick={() => executeAction(() => setRightPanelMode("document"))}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl hover:bg-accent text-foreground transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span className="truncate max-w-md">{doc.doc_name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{doc.chunks} chunks</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Sessions */}
          {filteredSessions.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Conversations ({filteredSessions.length})
              </div>
              <div className="space-y-1 mt-1">
                {filteredSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => executeAction(() => switchSession(s.id))}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl hover:bg-accent text-foreground transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-4 h-4 text-purple-400" />
                      <span className="truncate max-w-md">{s.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{s.messages.length} msgs</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
