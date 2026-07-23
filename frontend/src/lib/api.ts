// Typed API client for the AgentVerse FastAPI backend.

// In dev, Vite proxies /api -> http://localhost:8000 (see vite.config.ts).
const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export type SourceType = "pdf" | "docx" | "text";

export interface DocumentInfo {
  doc_id: string;
  doc_name: string;
  pages: number;
  chunks: number;
  source_type: SourceType;
  summary: string | null;
  suggested_questions: string[];
}

export interface Citation {
  marker: number;
  doc_id: string;
  doc_name: string;
  page: number;
  section: string | null;
  snippet: string;
  score: number;
  source_type: SourceType;
}

export interface Source {
  marker: number;
  chunk_id?: string;
  doc_id: string;
  doc_name: string;
  page: number;
  section: string | null;
  score: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskMeta {
  query_used: string;
  rewritten: boolean;
}

export interface TraceEntry {
  chunk_id: string;
  doc_name: string;
  page: number;
  rank: number;
  score: number;
}

export interface RetrievalTrace {
  query_used: string;
  rewritten: boolean;
  dense: TraceEntry[];
  bm25: TraceEntry[];
  fused: TraceEntry[];
  reranked: TraceEntry[];
  timings_ms: Record<string, number>;
}

export interface AnswerResponse {
  answer: string;
  citations: Citation[];
  grounded: boolean;
  retrieval_ms: number;
  generation_ms: number;
}

// --- AUTH & USER TYPINGS ---
export interface UserWorkspace {
  id: string;
  name: string;
  owner_id: string;
  user_role?: string;
  joined_at?: string;
  is_active?: boolean;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
}

export interface ConnectedAccountItem {
  provider: string;
  connected_at: string;
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  name: string;

  username: string;
  email: string;
  phone_number?: string | null;
  profile_picture?: string | null;
  role: string;
  permissions: string[];
  organization: string;
  workspace?: string | null;
  active_workspace?: UserWorkspace | null;
  account_status: string;
  email_verified: boolean;
  two_factor_enabled: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_login?: string | null;
  timezone: string;
  language: string;
  theme: string;
  notification_preferences: Record<string, boolean>;
  api_keys: ApiKeyItem[];
  connected_accounts: ConnectedAccountItem[];
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user: UserProfile;
}

export interface UserSessionItem {
  id: string;
  device: string;
  browser: string;
  ip_address: string;
  location: string;
  last_activity?: string;
  expires_at?: string;
  is_current: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  user_id?: string;
  username: string;
  action: string;
  resource: string;
  ip_address: string;
  details: Record<string, any>;
}

let storedAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  storedAccessToken = token;
}

export function getAccessToken(): string | null {
  return storedAccessToken;
}

async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (storedAccessToken) {
    headers.set("Authorization", `Bearer ${storedAccessToken}`);
  }
  const config: RequestInit = {
    ...init,
    headers,
    credentials: "include",
  };
  let res = await fetch(url, config);
  
  // Auto token refresh on 401 if refresh cookie present
  if (res.status === 401 && !url.includes("/auth/refresh") && !url.includes("/auth/login") && !url.includes("/auth/me")) {

    try {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) {
        const data: AuthResponse = await refreshRes.json();
        setAccessToken(data.access_token);
        headers.set("Authorization", `Bearer ${data.access_token}`);
        res = await fetch(url, { ...config, headers });
      }
    } catch {
      // Ignore refresh error
    }
  }

  return res;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as any).detail;
    const msg =
      typeof detail === "string"
        ? detail
        : detail?.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// --- AUTH CLIENT APIS ---
export async function registerUser(payload: any): Promise<AuthResponse> {
  const res = await fetchWithAuth(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await jsonOrThrow<AuthResponse>(res);
  setAccessToken(data.access_token);
  return data;
}

export async function loginUser(payload: any): Promise<AuthResponse> {
  const res = await fetchWithAuth(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await jsonOrThrow<AuthResponse>(res);
  setAccessToken(data.access_token);
  return data;
}

export async function logoutUser(): Promise<void> {
  await fetchWithAuth(`${BASE}/auth/logout`, { method: "POST" });
  setAccessToken(null);
}

export async function getMe(): Promise<UserProfile> {
  const res = await fetchWithAuth(`${BASE}/auth/me`);
  return jsonOrThrow<UserProfile>(res);
}

export async function forgotPassword(email: string): Promise<{ message: string; reset_token_dev?: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return jsonOrThrow(res);
}

export async function resetPassword(token: string, new_password: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password }),
  });
  return jsonOrThrow(res);
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return jsonOrThrow(res);
}

export async function getOAuthUrl(provider: string, redirectUri: string): Promise<{ url: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/oauth/${provider}/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
  return jsonOrThrow(res);
}

export async function oauthCallback(provider: string, code: string, redirectUri: string): Promise<AuthResponse> {
  const res = await fetchWithAuth(`${BASE}/auth/oauth/${provider}/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  const data = await jsonOrThrow<AuthResponse>(res);
  setAccessToken(data.access_token);
  return data;
}

export async function updateProfile(payload: any): Promise<UserProfile> {
  const res = await fetchWithAuth(`${BASE}/auth/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<UserProfile>(res);
}

export async function changePassword(payload: any): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

export async function createApiKey(name: string): Promise<{ key_id: string; api_key: string; name: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/api-keys?name=${encodeURIComponent(name)}`, {
    method: "POST",
  });
  return jsonOrThrow(res);
}

export async function revokeApiKey(keyId: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/api-keys/${keyId}`, {
    method: "DELETE",
  });
  return jsonOrThrow(res);
}

export async function deleteAccount(password: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/account?password=${encodeURIComponent(password)}`, {
    method: "DELETE",
  });
  setAccessToken(null);
  return jsonOrThrow(res);
}

// Workspaces
export async function listWorkspaces(): Promise<UserWorkspace[]> {
  const res = await fetchWithAuth(`${BASE}/auth/workspaces`);
  return jsonOrThrow<UserWorkspace[]>(res);
}

export async function createWorkspace(name: string): Promise<UserWorkspace> {
  const res = await fetchWithAuth(`${BASE}/auth/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow<UserWorkspace>(res);
}

export async function renameWorkspace(id: string, name: string): Promise<UserWorkspace> {
  const res = await fetchWithAuth(`${BASE}/auth/workspaces/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return jsonOrThrow<UserWorkspace>(res);
}

export async function deleteWorkspace(id: string): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/auth/workspaces/${id}`, { method: "DELETE" });
  await jsonOrThrow(res);
}

export async function switchWorkspace(id: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/workspaces/switch/${id}`, { method: "POST" });
  return jsonOrThrow(res);
}

// Sessions
export async function listSessions(): Promise<UserSessionItem[]> {
  const res = await fetchWithAuth(`${BASE}/auth/sessions`);
  return jsonOrThrow<UserSessionItem[]>(res);
}

export async function revokeSession(id: string): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/auth/sessions/${id}/revoke`, { method: "POST" });
  await jsonOrThrow(res);
}

export async function revokeOtherSessions(): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/auth/sessions/revoke-others`, { method: "POST" });
  await jsonOrThrow(res);
}

export async function revokeAllSessions(): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/auth/sessions/revoke-all`, { method: "POST" });
  setAccessToken(null);
  await jsonOrThrow(res);
}

// Admin
export async function adminListUsers(query?: string, statusFilter?: string, roleFilter?: string): Promise<UserProfile[]> {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (statusFilter) params.set("status_filter", statusFilter);
  if (roleFilter) params.set("role_filter", roleFilter);

  const res = await fetchWithAuth(`${BASE}/auth/admin/users?${params.toString()}`);
  return jsonOrThrow<UserProfile[]>(res);
}

export async function adminUpdateUserStatus(userId: string, statusVal: string): Promise<UserProfile> {
  const res = await fetchWithAuth(`${BASE}/auth/admin/users/${userId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: statusVal }),
  });
  return jsonOrThrow<UserProfile>(res);
}

export async function adminUpdateUserRole(userId: string, roleVal: string): Promise<UserProfile> {
  const res = await fetchWithAuth(`${BASE}/auth/admin/users/${userId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: roleVal }),
  });
  return jsonOrThrow<UserProfile>(res);
}

export async function adminForceResetPassword(userId: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`${BASE}/auth/admin/users/${userId}/reset-password?new_password=${encodeURIComponent(newPassword)}`, {
    method: "POST",
  });
  return jsonOrThrow(res);
}

export async function adminDeleteUser(userId: string): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/auth/admin/users/${userId}`, { method: "DELETE" });
  await jsonOrThrow(res);
}

export async function adminGetAuditLogs(action?: string, limit: number = 100): Promise<AuditLogItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (action) params.set("action", action);

  const res = await fetchWithAuth(`${BASE}/auth/admin/audit-logs?${params.toString()}`);
  return jsonOrThrow<AuditLogItem[]>(res);
}


// --- EXISTING APP ENDPOINTS WITH AUTH ---
export async function listDocuments(): Promise<DocumentInfo[]> {
  return jsonOrThrow(await fetchWithAuth(`${BASE}/documents`));
}

export async function uploadDocuments(files: File[]): Promise<void> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  await jsonOrThrow(await fetchWithAuth(`${BASE}/ingest`, { method: "POST", body: form }));
}

export async function deleteDocument(docId: string): Promise<void> {
  await jsonOrThrow(
    await fetchWithAuth(`${BASE}/documents/${docId}`, { method: "DELETE" })
  );
}

export function documentFileUrl(docId: string): string {
  return `${BASE}/documents/${docId}/file`;
}

export interface Health {
  status: string;
  qdrant_ok: boolean;
  indexed_chunks: number;
  models_ready: boolean;
}

export async function health(): Promise<Health> {
  return jsonOrThrow(await fetchWithAuth(`${BASE}/health`));
}

export interface StreamHandlers {
  onMeta?: (meta: AskMeta) => void;
  onSources?: (sources: Source[]) => void;
  onTrace?: (trace: RetrievalTrace) => void;
  onToken?: (token: string) => void;
  onDone?: (payload: { grounded: boolean; citations: Citation[] }) => void;
  onError?: (err: Error) => void;
}

export interface AskStreamBody {
  question: string;
  doc_ids: string[] | null;
  history?: ChatTurn[];
  include_trace?: boolean;
}

export async function askStream(
  body: AskStreamBody,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (storedAccessToken) {
      headers["Authorization"] = `Bearer ${storedAccessToken}`;
    }

    const res = await fetch(`${BASE}/ask/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
      credentials: "include",
    });
    if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        const ev = /event:\s*(.*)/.exec(frame)?.[1]?.trim();
        const dataLine = /data:\s*([\s\S]*)/.exec(frame)?.[1];
        if (!ev || dataLine == null) continue;
        const data = JSON.parse(dataLine);
        if (ev === "meta") handlers.onMeta?.(data);
        else if (ev === "sources") handlers.onSources?.(data);
        else if (ev === "trace") handlers.onTrace?.(data);
        else if (ev === "token") handlers.onToken?.(data);
        else if (ev === "done") handlers.onDone?.(data);
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      handlers.onError?.(err as Error);
    }
  }
}

export interface AgentStreamHandlers {
  onStepStart?: (data: any) => void;
  onStepUpdate?: (data: any) => void;
  onCompleted?: (data: any) => void;
  onError?: (err: Error) => void;
}

export async function runAgentStream(
  agentType: string,
  prompt: string,
  docIds: string[] | null,
  handlers: AgentStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (storedAccessToken) {
      headers["Authorization"] = `Bearer ${storedAccessToken}`;
    }

    const res = await fetch(`${BASE}/agents/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ agent_type: agentType, prompt, doc_ids: docIds }),
      signal,
      credentials: "include",
    });
    if (!res.ok || !res.body) throw new Error(`Agent stream failed (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = /data:\s*([\s\S]*)/.exec(frame)?.[1];
        if (!dataLine) continue;
        const data = JSON.parse(dataLine);
        if (data.event === "step_start") handlers.onStepStart?.(data);
        else if (data.event === "step_update") handlers.onStepUpdate?.(data);
        else if (data.event === "completed") handlers.onCompleted?.(data);
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      handlers.onError?.(err as Error);
    }
  }
}
