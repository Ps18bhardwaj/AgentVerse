import React, { useEffect, useState } from "react";
import { useStore } from "@/store";
import {
  adminDeleteUser,
  adminForceResetPassword,
  adminGetAuditLogs,
  adminListUsers,
  adminUpdateUserRole,
  adminUpdateUserStatus,
  AuditLogItem,
  UserProfile,
} from "@/lib/api";
import { toast } from "sonner";
import {
  FileText,
  KeyRound,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";

export const AdminPanelModal: React.FC = () => {
  const user = useStore((s) => s.user);
  const open = useStore((s) => s.adminModalOpen);
  const setOpen = useStore((s) => s.setAdminModalOpen);

  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");

  // User Management State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");


  // Force Password Reset Modal State
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [newPass, setNewPass] = useState("");

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchAuditLogs();
    }
  }, [open, searchQuery, statusFilter, roleFilter, actionFilter]);

  const fetchUsers = async () => {
    try {
      const res = await adminListUsers(searchQuery, statusFilter, roleFilter);
      setUsers(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load users.");
    }
  };


  const fetchAuditLogs = async () => {
    try {
      const res = await adminGetAuditLogs(actionFilter);
      setAuditLogs(res);
    } catch {
      // Ignore
    }
  };

  const handleToggleStatus = async (targetUser: UserProfile) => {
    const nextStatus = targetUser.account_status === "active" ? "suspended" : "active";
    try {
      const updated = await adminUpdateUserStatus(targetUser.id, nextStatus);
      toast.success(`User ${updated.username} status set to ${nextStatus}.`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Status update failed.");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const updated = await adminUpdateUserRole(userId, newRole);
      toast.success(`Role updated for ${updated.username} -> ${newRole}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Role update failed.");
    }
  };

  const handleForceReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetId || !newPass) return;
    try {
      const res = await adminForceResetPassword(resetTargetId, newPass);
      toast.success(res.message);
      setResetTargetId(null);
      setNewPass("");
    } catch (err: any) {
      toast.error(err.message || "Password reset failed.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user?")) return;
    try {
      await adminDeleteUser(userId);
      toast.success("User deleted successfully.");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "User deletion failed.");
    }
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className="relative flex h-[90vh] max-h-[750px] w-full max-w-5xl overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-2xl flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 p-4 bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">AgentVerse Enterprise IAM Admin Panel</h2>

              <p className="text-xs text-muted-foreground">User Management & System Audit Log Explorer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
              <button
                onClick={() => setActiveTab("users")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                  activeTab === "users" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Users ({users.length})
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                  activeTab === "audit" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Audit Logs ({auditLogs.length})
              </button>
            </div>

            <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: USERS */}
          {activeTab === "users" && (
            <div className="space-y-4">
              {/* Search Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search name, username, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-1.5 text-xs"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="locked">Locked</option>
                </select>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs"
                >
                  <option value="">All Roles</option>
                  <option value="System Owner">System Owner</option>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Member">Member</option>
                  <option value="Guest">Guest</option>
                </select>
              </div>

              {/* Users Table */}
              <div className="rounded-lg border border-border/80 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 border-b border-border/60 text-muted-foreground">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Username</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Created</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-secondary/20 transition">
                        <td className="p-3 font-medium flex items-center gap-2">
                          <img
                            src={
                              u.profile_picture ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${u.first_name}`
                            }
                            alt=""
                            className="w-7 h-7 rounded-full object-cover"
                          />
                          <div>
                            <div>{u.name}</div>
                            <div className="text-[11px] text-muted-foreground">{u.email}</div>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">@{u.username}</td>
                        <td className="p-3">
                          <select
                            value={u.role}
                            disabled={u.role === "System Owner" && user.role !== "System Owner"}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="rounded border border-input bg-background px-2 py-1 text-xs"
                          >
                            <option value="System Owner">System Owner</option>
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="Member">Member</option>
                            <option value="Guest">Guest</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              u.account_status === "active"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : u.account_status === "suspended"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-amber-500/20 text-amber-400"
                            }`}
                          >
                            {u.account_status}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            title={u.account_status === "active" ? "Suspend User" : "Activate User"}
                            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          >
                            {u.account_status === "active" ? (
                              <UserX className="w-4 h-4 text-red-400" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-emerald-400" />
                            )}
                          </button>
                          <button
                            onClick={() => setResetTargetId(u.id)}
                            title="Force Password Reset"
                            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                          >
                            <KeyRound className="w-4 h-4 text-amber-400" />
                          </button>
                          {u.role !== "System Owner" && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              title="Delete User Account"
                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  placeholder="Filter by action (e.g. LOGIN, REGISTER)..."
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs w-64"
                />
                <button onClick={fetchAuditLogs} className="p-1.5 rounded border hover:bg-accent">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-lg border border-border/80 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 border-b border-border/60 text-muted-foreground">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Resource</th>
                      <th className="p-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-secondary/20">
                        <td className="p-3 text-muted-foreground">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A"}
                        </td>
                        <td className="p-3 font-sans font-semibold">@{log.username}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{log.resource}</td>
                        <td className="p-3 text-muted-foreground">{log.ip_address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* FORCE RESET PASSWORD DIALOG */}
        {resetTargetId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <form onSubmit={handleForceReset} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xl">
              <h3 className="text-sm font-bold">Force Password Reset</h3>
              <input
                type="password"
                required
                placeholder="Enter new password for user..."
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setResetTargetId(null)}
                  className="px-3 py-1.5 rounded border text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold">
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
