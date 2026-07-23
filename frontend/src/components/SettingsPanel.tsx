import { Settings, Users, Lock, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SettingsPanel() {
  return (
    <div className="flex flex-col w-full h-full overflow-y-auto p-4 space-y-4 bg-background text-xs">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-indigo-400" />
            <span>Workspace Settings & RBAC</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">Manage organization profile, RBAC permissions, and team access</p>
        </div>

        <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400">
          Org ID: org-acme-corp
        </Badge>
      </div>

      <div className="space-y-4">
        <Card className="border-border bg-card/60">
          <CardHeader className="py-2.5 px-3 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Users className="h-4 w-4 text-indigo-400" />
              <span>Active Team Members</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border text-xs">
              <div>
                <span className="font-semibold text-foreground">Sarah Connor (You)</span>
                <p className="text-[10px] text-muted-foreground">admin@agentverse.ai</p>
              </div>
              <Badge className="bg-indigo-600 text-white text-[9px]">Admin</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border text-xs">
              <div>
                <span className="font-semibold text-foreground">Alex Rivera</span>
                <p className="text-[10px] text-muted-foreground">engineer@agentverse.ai</p>

              </div>
              <Badge variant="secondary" className="text-[9px]">Member</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/60">
          <CardHeader className="py-2.5 px-3 border-b border-border">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>Enterprise Single Sign-On (SSO)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border">
              <span>Google Workspace OAuth2</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border">
              <span>Microsoft Azure AD / Entra ID</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border">
              <span>GitHub Enterprise SSO</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
