import React, { useState } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  Pin,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Mic,
  Settings,
  Shield,
  Activity,
  Network,
  Plug,
  FileText,
  Check,
  LogOut,
} from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logoutUser } from "@/lib/api";

export function ChatSidebar() {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const sessions = useStore((s) => s.sessions);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const newSession = useStore((s) => s.newSession);
  const switchSession = useStore((s) => s.switchSession);
  const renameSession = useStore((s) => s.renameSession);
  const deleteSession = useStore((s) => s.deleteSession);
  const togglePinSession = useStore((s) => s.togglePinSession);
  const setVoiceOpen = useStore((s) => s.setVoiceOpen);
  const setDocsOpen = useStore((s) => s.setDocsOpen);
  const toggleRightPanel = useStore((s) => s.toggleRightPanel);
  const rightPanelMode = useStore((s) => s.rightPanelMode);

  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const setAuthStatus = useStore((s) => s.setAuthStatus);
  const setProfileModalOpen = useStore((s) => s.setProfileModalOpen);
  const setAdminModalOpen = useStore((s) => s.setAdminModalOpen);

  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const allSessions = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);
  const filteredSessions = allSessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );
  const pinnedSessions = filteredSessions.filter((s) => s.isPinned);
  const unpinnedSessions = filteredSessions.filter((s) => !s.isPinned);

  const handleStartRename = (id: string, title: string) => {
    setEditingId(id);
    setEditTitle(title);
  };

  const handleSaveRename = (id: string) => {
    renameSession(id, editTitle);
    setEditingId(null);
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card/70 backdrop-blur-xl transition-all duration-300 select-none z-20 h-full",
        collapsed ? "w-16" : "w-72"
      )}
    >
      {/* Top Header: Brand & New Chat */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2 font-bold tracking-tight text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent font-extrabold">
                  AgentVerse AI
                </span>

                <span className="text-[10px] text-muted-foreground font-mono">Enterprise Workspace</span>
              </div>
            </div>
          )}

          {collapsed && (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* New Chat Button */}
        <Button
          onClick={() => newSession()}
          className={cn(
            "w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs shadow-md shadow-indigo-500/20 gap-2",
            collapsed && "px-0 justify-center"
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>New Conversation</span>}
        </Button>
      </div>

      {/* Search Bar */}
      {!collapsed && (
        <div className="p-2 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-background/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Quick Action Tools */}
      <div className="p-2 border-b border-border/60 space-y-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setVoiceOpen(true)}
          className={cn(
            "w-full justify-start gap-2 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 text-xs",
            collapsed && "justify-center px-0"
          )}
        >
          <Mic className="h-3.5 w-3.5 shrink-0 text-indigo-400 animate-pulse" />
          {!collapsed && <span>Voice AI Mode</span>}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDocsOpen(true)}
          className={cn(
            "w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>Scoped Documents</span>}
        </Button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* Pinned Chats */}
        {!collapsed && pinnedSessions.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Pin className="h-3 w-3 text-amber-400" />
              <span>Pinned</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {pinnedSessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={s.id === activeSessionId}
                  editing={editingId === s.id}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  onSelect={() => switchSession(s.id)}
                  onStartRename={() => handleStartRename(s.id, s.title)}
                  onSaveRename={() => handleSaveRename(s.id)}
                  onDelete={() => deleteSession(s.id)}
                  onTogglePin={() => togglePinSession(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All / Unpinned Chats */}
        <div>
          {!collapsed && (
            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Recent Conversations ({filteredSessions.length})
            </div>
          )}
          <div className="space-y-0.5 mt-1">
            {unpinnedSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                collapsed={collapsed}
                active={s.id === activeSessionId}
                editing={editingId === s.id}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                onSelect={() => switchSession(s.id)}
                onStartRename={() => handleStartRename(s.id, s.title)}
                onSaveRename={() => handleSaveRename(s.id)}
                onDelete={() => deleteSession(s.id)}
                onTogglePin={() => togglePinSession(s.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* User Profile & IAM Footer */}
      <div className="p-2 border-t border-border/80 space-y-1 bg-card/40">
        {!collapsed && (
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-2">
            Contextual Inspectors
          </span>
        )}
        <div className="grid grid-cols-5 gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Knowledge Graph Inspector"
            onClick={() => toggleRightPanel("graph")}
            className={cn("h-7 w-7", rightPanelMode === "graph" && "bg-cyan-500/20 text-cyan-400")}
          >
            <Network className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="SaaS Connectors"
            onClick={() => toggleRightPanel("connectors")}
            className={cn("h-7 w-7", rightPanelMode === "connectors" && "bg-indigo-500/20 text-indigo-400")}
          >
            <Plug className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Human Review Queue"
            onClick={() => toggleRightPanel("human_loop")}
            className={cn("h-7 w-7", rightPanelMode === "human_loop" && "bg-emerald-500/20 text-emerald-400")}
          >
            <Shield className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Observability & Telemetry"
            onClick={() => toggleRightPanel("telemetry")}
            className={cn("h-7 w-7", rightPanelMode === "telemetry" && "bg-purple-500/20 text-purple-400")}
          >
            <Activity className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Settings & Workspace"
            onClick={() => toggleRightPanel("settings")}
            className={cn("h-7 w-7", rightPanelMode === "settings" && "bg-amber-500/20 text-amber-400")}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* User Card */}
        {user && (
          <div className="pt-2 mt-1 border-t border-border/40 flex items-center justify-between gap-2 px-1">
            <button
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center gap-2 min-w-0 flex-1 hover:bg-accent/60 p-1.5 rounded-lg text-left transition"
              title="User Profile & Settings"
            >
              <img
                src={
                  user.profile_picture ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${user.first_name}`
                }
                alt=""
                className="w-6 h-6 rounded-full object-cover shrink-0 border border-primary/30"
              />
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate leading-tight">{user.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{user.role}</div>
                </div>
              )}
            </button>

            {!collapsed && (
              <div className="flex items-center gap-1 shrink-0">
                {(user.role === "System Owner" || user.role === "Admin") && (
                  <button
                    onClick={() => setAdminModalOpen(true)}
                    className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/20 transition"
                    title="Admin Panel"
                  >
                    <Shield className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={async () => {
                    await logoutUser();
                    setUser(null);
                    setAuthStatus("unauthenticated");
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}


interface SessionRowProps {
  session: any;
  active: boolean;
  collapsed?: boolean;
  editing: boolean;
  editTitle: string;
  setEditTitle: (t: string) => void;
  onSelect: () => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

function SessionRow({
  session,
  active,
  collapsed,
  editing,
  editTitle,
  setEditTitle,
  onSelect,
  onStartRename,
  onSaveRename,
  onDelete,
  onTogglePin,
}: SessionRowProps) {
  if (collapsed) {
    return (
      <button
        onClick={onSelect}
        className={cn(
          "flex h-8 w-8 mx-auto items-center justify-center rounded-lg text-xs transition-colors",
          active ? "bg-indigo-600 text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        title={session.title}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          autoFocus
          className="w-full h-7 px-2 text-xs bg-background border border-border rounded text-foreground"
          onKeyDown={(e) => e.key === "Enter" && onSaveRename()}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onSaveRename}>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors relative",
        active
          ? "bg-indigo-600/15 text-foreground border border-indigo-500/30 font-medium"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <MessageSquare className={cn("h-3.5 w-3.5 shrink-0", active ? "text-indigo-400" : "text-muted-foreground")} />
        <span className="truncate text-xs">{session.title}</span>
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className="p-1 hover:text-amber-400"
          title="Pin conversation"
        >
          <Pin className={cn("h-3 w-3", session.isPinned && "text-amber-400 fill-current")} />
        </button>
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onStartRename();
          }}
          className="p-1 hover:text-indigo-400"
          title="Rename conversation"
        >
          <Edit2 className="h-3 w-3" />
        </button>
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 hover:text-red-400"
          title="Delete conversation"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
