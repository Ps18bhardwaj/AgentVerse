import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AskMeta, Citation, RetrievalTrace, Source, UserProfile, UserWorkspace } from "@/lib/api";


export type Theme = "light" | "dark" | "system";

export type RightPanelMode =
  | "closed"
  | "document"
  | "graph"
  | "agent"
  | "connectors"
  | "telemetry"
  | "human_loop"
  | "settings";

export interface ViewerTarget {
  docId: string;
  docName: string;
  page: number;
  snippet?: string;
}

export interface AgentStepTrace {
  step_index: number;
  title: string;
  status: "pending" | "running" | "completed" | "failed";
  thought?: string;
  tool_call?: string;
}

export interface AttachedFileMeta {
  id: string;
  name: string;
  size: number;
  docId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachedFiles?: AttachedFileMeta[];
  sources?: Source[];
  citations?: Citation[];
  grounded?: boolean;
  streaming?: boolean;
  meta?: AskMeta;
  trace?: RetrievalTrace;
  agentSteps?: AgentStepTrace[];
  approvalTask?: {
    id: string;
    title: string;
    description: string;
    proposedAction: string;
    status: "pending" | "approved" | "rejected";
  };
}

export interface ChatSession {
  id: string;
  title: string;
  folderId?: string;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
}

const MAX_SESSIONS = 50;
const MAX_MESSAGES = 200;

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function makeSession(): ChatSession {
  const now = Date.now();
  return { id: newId(), title: "New chat", createdAt: now, updatedAt: now, messages: [] };
}

interface AppState {
  theme: Theme;
  setTheme: (t: Theme) => void;

  // AUTH & IAM STATE
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  authStatus: "loading" | "authenticated" | "unauthenticated";
  setAuthStatus: (status: "loading" | "authenticated" | "unauthenticated") => void;
  workspaces: UserWorkspace[];
  setWorkspaces: (ws: UserWorkspace[]) => void;
  profileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
  adminModalOpen: boolean;
  setAdminModalOpen: (open: boolean) => void;
  workspaceModalOpen: boolean;
  setWorkspaceModalOpen: (open: boolean) => void;

  // Citation viewer target
  viewer: ViewerTarget | null;
  openViewer: (v: ViewerTarget) => void;
  closeViewer: () => void;


  // Dynamic Right Contextual Side Panel Mode
  rightPanelMode: RightPanelMode;
  setRightPanelMode: (mode: RightPanelMode) => void;
  toggleRightPanel: (mode: RightPanelMode) => void;

  // Active Contextual Data for Right Panel
  activeAgentTask: any | null;
  setActiveAgentTask: (task: any | null) => void;
  activeGraphEntity: string | null;
  setActiveGraphEntity: (entity: string | null) => void;

  // Left Sidebar State & Folders
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  folders: Folder[];
  createFolder: (name: string) => void;
  deleteFolder: (id: string) => void;
  moveSessionToFolder: (sessionId: string, folderId?: string) => void;
  togglePinSession: (id: string) => void;

  // Documents selection
  docsOpen: boolean;
  setDocsOpen: (open: boolean) => void;
  selectedDocIds: string[];
  toggleDoc: (id: string) => void;
  clearSelection: () => void;

  // Voice Chat overlay modal state
  voiceOpen: boolean;
  setVoiceOpen: (open: boolean) => void;

  // Settings Modal State
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // Chat Sessions
  sessions: Record<string, ChatSession>;
  activeSessionId: string | null;
  newSession: () => void;
  switchSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;

  // Command Palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Message operations
  pinnedMessageIds: string[];
  togglePinMessage: (id: string) => void;
  addMessage: (m: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  appendToken: (id: string, token: string) => void;
}

function mutateActive(
  s: Pick<AppState, "sessions" | "activeSessionId">,
  fn: (session: ChatSession) => ChatSession
): Partial<AppState> {
  let id = s.activeSessionId;
  let sessions = s.sessions;
  if (!id || !sessions[id]) {
    const fresh = makeSession();
    id = fresh.id;
    sessions = { ...sessions, [fresh.id]: fresh };
    const all = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);
    if (all.length > MAX_SESSIONS) {
      sessions = Object.fromEntries(all.slice(0, MAX_SESSIONS).map((x) => [x.id, x]));
    }
  }
  const updated = fn(sessions[id]);
  return {
    activeSessionId: id,
    sessions: { ...sessions, [id]: { ...updated, updatedAt: Date.now() } },
  };
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (t) => set({ theme: t }),

      user: null,
      setUser: (u) => set({ user: u }),
      authStatus: "loading",
      setAuthStatus: (status) => set({ authStatus: status }),
      workspaces: [],
      setWorkspaces: (ws) => set({ workspaces: ws }),
      profileModalOpen: false,
      setProfileModalOpen: (open) => set({ profileModalOpen: open }),
      adminModalOpen: false,
      setAdminModalOpen: (open) => set({ adminModalOpen: open }),
      workspaceModalOpen: false,
      setWorkspaceModalOpen: (open) => set({ workspaceModalOpen: open }),

      viewer: null,

      openViewer: (v) =>
        set({
          viewer: v,
          rightPanelMode: "document",
        }),
      closeViewer: () => set({ viewer: null }),

      rightPanelMode: "closed",
      setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
      toggleRightPanel: (mode) =>
        set((s) => ({ rightPanelMode: s.rightPanelMode === mode ? "closed" : mode })),

      activeAgentTask: null,
      setActiveAgentTask: (task) => set({ activeAgentTask: task }),
      activeGraphEntity: null,
      setActiveGraphEntity: (entity) => set({ activeGraphEntity: entity }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      folders: [
        { id: "fld-work", name: "Architecture & Research", color: "indigo" },
        { id: "fld-dev", name: "Engineering & Code", color: "emerald" },
      ],
      createFolder: (name) =>
        set((s) => ({
          folders: [...s.folders, { id: `fld-${Date.now()}`, name }],
        })),
      deleteFolder: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          sessions: Object.fromEntries(
            Object.entries(s.sessions).map(([sid, sess]) => [
              sid,
              sess.folderId === id ? { ...sess, folderId: undefined } : sess,
            ])
          ),
        })),
      moveSessionToFolder: (sessionId, folderId) =>
        set((s) => {
          const sess = s.sessions[sessionId];
          if (!sess) return {};
          return {
            sessions: { ...s.sessions, [sessionId]: { ...sess, folderId } },
          };
        }),
      togglePinSession: (id) =>
        set((s) => {
          const sess = s.sessions[id];
          if (!sess) return {};
          return {
            sessions: { ...s.sessions, [id]: { ...sess, isPinned: !sess.isPinned } },
          };
        }),

      docsOpen: false,
      setDocsOpen: (open) => set({ docsOpen: open }),

      selectedDocIds: [],
      toggleDoc: (id) =>
        set((s) => ({
          selectedDocIds: s.selectedDocIds.includes(id)
            ? s.selectedDocIds.filter((d) => d !== id)
            : [...s.selectedDocIds, id],
        })),
      clearSelection: () => set({ selectedDocIds: [] }),

      voiceOpen: false,
      setVoiceOpen: (open) => set({ voiceOpen: open }),

      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),

      sessions: {},
      activeSessionId: null,
      newSession: () => {
        const fresh = makeSession();
        set((s) => ({
          sessions: { ...s.sessions, [fresh.id]: fresh },
          activeSessionId: fresh.id,
        }));
      },
      switchSession: (id) =>
        set((s) => (s.sessions[id] ? { activeSessionId: id } : {})),
      renameSession: (id, title) =>
        set((s) => {
          const sess = s.sessions[id];
          if (!sess) return {};
          return {
            sessions: { ...s.sessions, [id]: { ...sess, title: title.trim() || sess.title } },
          };
        }),
      deleteSession: (id) =>
        set((s) => {
          const { [id]: _gone, ...rest } = s.sessions;
          return {
            sessions: rest,
            activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
          };
        }),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      pinnedMessageIds: [],
      togglePinMessage: (id) =>
        set((s) => ({
          pinnedMessageIds: s.pinnedMessageIds.includes(id)
            ? s.pinnedMessageIds.filter((p) => p !== id)
            : [...s.pinnedMessageIds, id],
        })),

      addMessage: (m) =>
        set((s) =>
          mutateActive(s, (sess) => {
            const messages = [...sess.messages, m].slice(-MAX_MESSAGES);
            const title =
              sess.title === "New chat" && m.role === "user"
                ? m.content.slice(0, 40) + (m.content.length > 40 ? "…" : "")
                : sess.title;
            return { ...sess, messages, title };
          })
        ),
      updateMessage: (id, patch) =>
        set((s) =>
          mutateActive(s, (sess) => ({
            ...sess,
            messages: sess.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
          }))
        ),
      appendToken: (id, token) =>
        set((s) =>
          mutateActive(s, (sess) => ({
            ...sess,
            messages: sess.messages.map((m) =>
              m.id === id ? { ...m, content: m.content + token } : m
            ),
          }))
        ),
    }),
    {
      name: "agentverse-conversational-store",

      version: 4,
      migrate: (state: any) => state,
      partialize: (s) => ({
        theme: s.theme,
        activeSessionId: s.activeSessionId,
        folders: s.folders,
        sessions: Object.fromEntries(
          Object.entries(s.sessions).map(([id, sess]) => [
            id,
            {
              ...sess,
              messages: sess.messages.map(
                ({ trace: _t, streaming: _s, ...m }) => m
              ),
            },
          ])
        ),
      }),
    }
  )
);

export const useActiveMessages = () =>
  useStore((s) =>
    s.activeSessionId ? (s.sessions[s.activeSessionId]?.messages ?? EMPTY) : EMPTY
  );
const EMPTY: ChatMessage[] = [];
