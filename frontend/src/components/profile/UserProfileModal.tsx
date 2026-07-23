import React, { useEffect, useState } from "react";
import { useStore } from "@/store";
import {
  changePassword,
  createApiKey,
  createWorkspace,
  deleteAccount,
  deleteWorkspace,
  listSessions,
  listWorkspaces,
  revokeAllSessions,
  revokeApiKey,
  revokeOtherSessions,
  revokeSession,
  switchWorkspace,
  updateProfile,
  UserSessionItem,
  UserWorkspace,
} from "@/lib/api";
import { PasswordStrengthMeter } from "../auth/PasswordStrengthMeter";
import { toast } from "sonner";
import {
  Bell,
  Key,
  Laptop,
  Plus,
  Shield,
  Smartphone,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";


export const UserProfileModal: React.FC = () => {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const open = useStore((s) => s.profileModalOpen);
  const setOpen = useStore((s) => s.setProfileModalOpen);
  const setAuthStatus = useStore((s) => s.setAuthStatus);

  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "workspaces" | "sessions" | "apikeys" | "notifications"
  >("profile");

  // Profile Form State
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [phone, setPhone] = useState(user?.phone_number || "");
  const [avatar, setAvatar] = useState(user?.profile_picture || "");
  const [timezone, setTimezone] = useState(user?.timezone || "UTC");
  const [language, setLanguage] = useState(user?.language || "en");
  const [themePref, setThemePref] = useState(user?.theme || "system");

  // Password Change State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePass, setDeletePass] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Workspaces State
  const [workspaces, setWorkspaces] = useState<UserWorkspace[]>([]);
  const [newWsName, setNewWsName] = useState("");

  // Sessions State
  const [sessions, setSessions] = useState<UserSessionItem[]>([]);

  // API Keys State
  const [keyName, setKeyName] = useState("");
  const [newCreatedKey, setNewCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setUsername(user.username || "");
      setPhone(user.phone_number || "");
      setAvatar(user.profile_picture || "");
      setTimezone(user.timezone || "UTC");
      setLanguage(user.language || "en");
      setThemePref(user.theme || "system");
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      fetchWorkspaces();
      fetchSessions();
    }
  }, [open]);

  const fetchWorkspaces = async () => {
    try {
      const res = await listWorkspaces();
      setWorkspaces(res);
    } catch {
      // Ignore
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await listSessions();
      setSessions(res);
    } catch {
      // Ignore
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        username,
        phone_number: phone,
        profile_picture: avatar,
        timezone,
        language,
        theme: themePref,
      });
      setUser(updated);
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await changePassword({ old_password: oldPassword, new_password: newPassword });
      toast.success(res.message);
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to change password.");
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      await createWorkspace(newWsName);
      setNewWsName("");
      toast.success("Workspace created!");
      fetchWorkspaces();
      const me = await updateProfile({}); // Refresh user state
      setUser(me);
    } catch (err: any) {
      toast.error(err.message || "Failed to create workspace.");
    }
  };

  const handleSwitchWs = async (id: string) => {
    try {
      await switchWorkspace(id);
      toast.success("Active workspace switched!");
      fetchWorkspaces();
      const me = await updateProfile({});
      setUser(me);
    } catch (err: any) {
      toast.error(err.message || "Failed to switch workspace.");
    }
  };

  const handleDeleteWs = async (id: string) => {
    try {
      await deleteWorkspace(id);
      toast.success("Workspace deleted.");
      fetchWorkspaces();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete workspace.");
    }
  };

  const handleRevokeSession = async (id: string) => {
    try {
      await revokeSession(id);
      toast.success("Session revoked.");
      fetchSessions();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke session.");
    }
  };

  const handleRevokeOthers = async () => {
    try {
      await revokeOtherSessions();
      toast.success("All other sessions revoked.");
      fetchSessions();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke sessions.");
    }
  };

  const handleRevokeAll = async () => {
    try {
      await revokeAllSessions();
      setUser(null);
      setAuthStatus("unauthenticated");
      setOpen(false);
      toast.success("Logged out from all devices.");
    } catch (err: any) {
      toast.error(err.message || "Failed to logout everywhere.");
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createApiKey(keyName || "Default Key");
      setNewCreatedKey(res.api_key);
      setKeyName("");
      toast.success("API key created!");
      const me = await updateProfile({});
      setUser(me);
    } catch (err: any) {
      toast.error(err.message || "Failed to create API key.");
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await revokeApiKey(id);
      toast.success("API key revoked.");
      const me = await updateProfile({});
      setUser(me);
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke key.");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount(deletePass);
      setUser(null);
      setAuthStatus("unauthenticated");
      setOpen(false);
      toast.success("Account deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account.");
    }
  };

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className="relative flex h-[90vh] max-h-[700px] w-full max-w-4xl overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-2xl">
        {/* Left Tabs Sidebar */}
        <div className="w-60 shrink-0 border-r border-border/60 bg-secondary/20 p-4 space-y-2 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2 py-1">
              <img
                src={
                  user.profile_picture ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${user.first_name}`
                }
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover border border-primary/40"
              />
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{user.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{user.role}</div>
              </div>
            </div>

            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("profile")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
                  activeTab === "profile" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <User className="w-4 h-4" /> Profile & Settings
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
                  activeTab === "security" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <Shield className="w-4 h-4" /> Security & Passwords
              </button>
              <button
                onClick={() => setActiveTab("workspaces")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
                  activeTab === "workspaces" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <Users className="w-4 h-4" /> Workspaces & Teams
              </button>
              <button
                onClick={() => setActiveTab("sessions")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
                  activeTab === "sessions" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <Laptop className="w-4 h-4" /> Active Sessions
              </button>
              <button
                onClick={() => setActiveTab("apikeys")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
                  activeTab === "apikeys" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <Key className="w-4 h-4" /> API Keys
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition ${
                  activeTab === "notifications" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <Bell className="w-4 h-4" /> Notifications
              </button>
            </nav>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium border border-border/80 rounded-lg hover:bg-accent transition"
          >
            Close Settings
          </button>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>

          {/* TAB 1: PROFILE */}
          {activeTab === "profile" && (
            <form onSubmit={handleUpdateProfile} className="space-y-5 max-w-xl">
              <h2 className="text-lg font-bold">Personal Profile Settings</h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Avatar URL</label>
                <input
                  type="text"
                  value={avatar}
                  placeholder="https://images.unsplash.com/..."
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="UTC">UTC (Universal Time)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Theme</label>
                  <select
                    value={themePref}
                    onChange={(e) => setThemePref(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="system">System Default</option>
                    <option value="dark">Dark Theme</option>
                    <option value="light">Light Theme</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition"
              >
                Save Profile Changes
              </button>
            </form>
          )}

          {/* TAB 2: SECURITY */}
          {activeTab === "security" && (
            <div className="space-y-6 max-w-xl">
              <h2 className="text-lg font-bold">Security & Password Management</h2>

              <form onSubmit={handleChangePassword} className="space-y-3.5 border-b border-border/60 pb-6">
                <h3 className="text-sm font-semibold">Change Password</h3>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Current Password</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                  />
                  <PasswordStrengthMeter password={newPassword} />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Update Password
                </button>
              </form>

              {/* Danger Zone */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-red-500">Danger Zone</h3>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-medium hover:bg-red-500/10"
                  >
                    Delete Account
                  </button>
                ) : (
                  <div className="space-y-2 p-3 rounded-lg border border-red-500/40 bg-red-500/10">
                    <p className="text-xs text-red-300">
                      Confirm deletion by entering your current password:
                    </p>
                    <input
                      type="password"
                      placeholder="Current Password"
                      value={deletePass}
                      onChange={(e) => setDeletePass(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WORKSPACES */}
          {activeTab === "workspaces" && (
            <div className="space-y-6 max-w-xl">
              <h2 className="text-lg font-bold">Workspace Multi-Tenancy</h2>

              <form onSubmit={handleCreateWorkspace} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New Workspace Name..."
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" /> Create
                </button>
              </form>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">Your Workspaces</h3>
                <div className="space-y-2">
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-secondary/10"
                    >
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {ws.name}
                          {ws.is_active && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">Role: {ws.user_role}</div>
                      </div>

                      <div className="flex gap-2">
                        {!ws.is_active && (
                          <button
                            onClick={() => handleSwitchWs(ws.id)}
                            className="px-3 py-1 rounded bg-secondary text-xs hover:bg-accent"
                          >
                            Switch
                          </button>
                        )}
                        {ws.owner_id === user.id && (
                          <button
                            onClick={() => handleDeleteWs(ws.id)}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SESSIONS */}
          {activeTab === "sessions" && (
            <div className="space-y-6 max-w-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Active Devices & Sessions</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleRevokeOthers}
                    className="px-2.5 py-1 text-xs font-medium rounded border border-border hover:bg-accent"
                  >
                    Revoke Other Devices
                  </button>
                  <button
                    onClick={handleRevokeAll}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-red-600 text-white"
                  >
                    Logout Everywhere
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-secondary/10"
                  >
                    <div className="flex items-center gap-3">
                      {s.device.includes("Mobile") ? (
                        <Smartphone className="w-5 h-5 text-primary" />
                      ) : (
                        <Laptop className="w-5 h-5 text-primary" />
                      )}
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {s.browser} on {s.device}
                          {s.is_current && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">
                              Current Device
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          IP: {s.ip_address} • Location: {s.location}
                        </div>
                      </div>
                    </div>

                    {!s.is_current && (
                      <button
                        onClick={() => handleRevokeSession(s.id)}
                        className="px-2.5 py-1 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: API KEYS */}
          {activeTab === "apikeys" && (
            <div className="space-y-6 max-w-xl">
              <h2 className="text-lg font-bold">Personal API Keys</h2>

              <form onSubmit={handleCreateApiKey} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Key Name (e.g. CLI Script)..."
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Generate Key
                </button>
              </form>

              {newCreatedKey && (
                <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-xs space-y-1">
                  <div className="font-bold text-emerald-400">Save your new API Key:</div>
                  <div className="font-mono bg-background p-2 rounded border border-border select-all">
                    {newCreatedKey}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    This key will not be displayed again.
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {user.api_keys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-secondary/10"
                  >
                    <div>
                      <div className="font-semibold text-sm">{k.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{k.prefix}</div>
                    </div>
                    <button
                      onClick={() => handleRevokeKey(k.id)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="space-y-4 max-w-xl">
              <h2 className="text-lg font-bold">Notification Preferences</h2>
              <div className="space-y-3">
                {Object.entries(user.notification_preferences || {}).map(([key, val]) => (
                  <label key={key} className="flex items-center justify-between p-3 rounded-lg border border-border/80 cursor-pointer">
                    <span className="text-xs font-medium capitalize">{key.replace(/_/g, " ")}</span>
                    <input type="checkbox" defaultChecked={val} className="rounded border-input text-primary" />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
