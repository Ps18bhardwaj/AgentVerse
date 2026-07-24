import React, { useState } from "react";
import {
  Settings,
  Users,
  Lock,
  CheckCircle2,
  UserPlus,
  Trash2,
  Sliders,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useStore } from "@/store";

export function SettingsPanel() {
  const user = useStore((s) => s.user);
  const teamMembers = useStore((s) => s.teamMembers);
  const addTeamMember = useStore((s) => s.addTeamMember);
  const removeTeamMember = useStore((s) => s.removeTeamMember);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Member" | "Viewer">("Member");

  // Realistic RAG settings
  const [chunkSize, setChunkSize] = useState("512");
  const [chunkOverlap, setChunkOverlap] = useState("64");
  const [requireHumanApproval, setRequireHumanApproval] = useState(true);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error("Please enter a valid name and email address.");
      return;
    }
    addTeamMember({
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
    });
    toast.success(`Team member '${inviteName}' invited successfully!`);
    setInviteName("");
    setInviteEmail("");
    setShowInviteForm(false);
  };

  const currentUserDisplayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : "System Owner (You)";
  const currentUserEmail = user?.email || "owner@agentverse.ai";
  const currentUserRole = user?.role || "System Owner";

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto p-4 space-y-4 bg-background text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-indigo-400" />
            <span>Workspace Settings &amp; RBAC</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Manage organization profile, RBAC permissions, and team access
          </p>
        </div>

        <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400">
          Org ID: org-agentverse-main
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Active Team Members Card */}
        <Card className="border-border bg-card/60">
          <CardHeader className="py-2.5 px-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Users className="h-4 w-4 text-indigo-400" />
              <span>Active Team Members ({1 + teamMembers.length})</span>
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="h-6 text-[10px] gap-1 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
            >
              <UserPlus className="h-3 w-3" />
              Invite Member
            </Button>
          </CardHeader>

          <CardContent className="p-3 space-y-2">
            {/* Invite Form */}
            {showInviteForm && (
              <form onSubmit={handleAddMember} className="p-3 rounded-xl border border-indigo-500/40 bg-indigo-950/20 space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300 text-xs">Invite New Team Member</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowInviteForm(false)} className="h-5 text-[10px]">
                    Cancel
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Full Name (e.g. Alex Rivera)"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email (e.g. alex@company.com)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Select Role:</span>
                  <select
                    value={inviteRole}
                    onChange={(e: any) => setInviteRole(e.target.value)}
                    className="bg-background border border-border rounded-lg p-1.5 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Member">Member</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                  <Button type="submit" size="sm" className="ml-auto h-7 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                    Send Invite
                  </Button>
                </div>
              </form>
            )}

            {/* Current Active User (Always displayed) */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-indigo-500/30 text-xs">
              <div>
                <span className="font-bold text-foreground">{currentUserDisplayName}</span>
                <p className="text-[10px] text-muted-foreground">{currentUserEmail}</p>
              </div>
              <Badge className="bg-indigo-600 text-white text-[9px] px-2 py-0.5">{currentUserRole}</Badge>
            </div>

            {/* User Added Team Members */}
            {teamMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border text-xs">
                <div>
                  <span className="font-semibold text-foreground">{m.name}</span>
                  <p className="text-[10px] text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px]">
                    {m.role}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      removeTeamMember(m.id);
                      toast.success(`Removed team member ${m.name}`);
                    }}
                    className="h-6 w-6 text-muted-foreground hover:text-red-400"
                    title="Remove member"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {teamMembers.length === 0 && (
              <p className="text-[11px] text-muted-foreground pt-1">
                No additional team members added. Use the &apos;Invite Member&apos; button above to grant workspace access.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Realistic Project RAG & System Settings */}
        <Card className="border-border bg-card/60">
          <CardHeader className="py-2.5 px-3 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <span>RAG Engine &amp; Vector Index Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">
                  Chunk Size (Tokens)
                </label>
                <select
                  value={chunkSize}
                  onChange={(e) => setChunkSize(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-cyan-500"
                >
                  <option value="256">256 Tokens (High Precision)</option>
                  <option value="512">512 Tokens (Standard Balance)</option>
                  <option value="1024">1024 Tokens (Broad Context)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">
                  Chunk Overlap
                </label>
                <select
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-cyan-500"
                >
                  <option value="32">32 Tokens</option>
                  <option value="64">64 Tokens (Recommended)</option>
                  <option value="128">128 Tokens</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border">
              <div>
                <span className="font-semibold text-foreground">Zero-Trust Human Approval Queue</span>
                <p className="text-[10px] text-muted-foreground">Require human confirmation before agent executing actions</p>
              </div>
              <input
                type="checkbox"
                checked={requireHumanApproval}
                onChange={(e) => {
                  setRequireHumanApproval(e.target.checked);
                  toast.success(`Zero-Trust Approval ${e.target.checked ? "Enabled" : "Disabled"}`);
                }}
                className="h-4 w-4 accent-emerald-500 cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        {/* Enterprise Single Sign-On (SSO) */}
        <Card className="border-border bg-card/60">
          <CardHeader className="py-2.5 px-3 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>Enterprise Single Sign-On (SSO)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border">
              <span>Google Workspace OAuth2</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border">
              <span>Microsoft Azure AD / Entra ID</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border">
              <span>GitHub Enterprise SSO</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
