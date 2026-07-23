import { useState } from "react";
import { Plug, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Connector {
  id: string;
  name: string;
  type: string;
  status: "connected" | "disconnected" | "syncing";
  lastSync: string;
  indexedDocs: number;
}

const CONNECTORS: Connector[] = [
  { id: "conn-gdrive", name: "Google Drive", type: "Storage", status: "connected", lastSync: "2 mins ago", indexedDocs: 42 },
  { id: "conn-github", name: "GitHub Repositories", type: "Engineering", status: "connected", lastSync: "1 hour ago", indexedDocs: 128 },
  { id: "conn-notion", name: "Notion Workspaces", type: "Wiki", status: "connected", lastSync: "15 mins ago", indexedDocs: 34 },
  { id: "conn-slack", name: "Slack Channels", type: "Communication", status: "disconnected", lastSync: "Never", indexedDocs: 0 },
  { id: "conn-jira", name: "Jira Projects", type: "Tracker", status: "connected", lastSync: "4 hours ago", indexedDocs: 89 },
  { id: "conn-confluence", name: "Confluence Wiki", type: "Wiki", status: "disconnected", lastSync: "Never", indexedDocs: 0 },
  { id: "conn-gmail", name: "Gmail Threads", type: "Mail", status: "disconnected", lastSync: "Never", indexedDocs: 0 },
  { id: "conn-dropbox", name: "Dropbox Storage", type: "Storage", status: "disconnected", lastSync: "Never", indexedDocs: 0 },
  { id: "conn-arxiv", name: "arXiv Research Papers", type: "Academic", status: "connected", lastSync: "1 day ago", indexedDocs: 15 },
];

export function ConnectorsPanel() {
  const [items, setItems] = useState<Connector[]>(CONNECTORS);

  const handleToggle = (id: string) => {
    setItems((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === "connected" ? "disconnected" : "connected";
          toast.success(`${c.name} ${nextStatus === "connected" ? "connected & indexing" : "disconnected"}`);
          return {
            ...c,
            status: nextStatus,
            lastSync: nextStatus === "connected" ? "Just now" : c.lastSync,
            indexedDocs: nextStatus === "connected" ? c.indexedDocs + 10 : c.indexedDocs,
          };
        }
        return c;
      })
    );
  };

  const handleSync = (id: string) => {
    toast.info(`Triggered background sync for ${items.find((c) => c.id === id)?.name}`);
  };

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto p-4 space-y-4 bg-background text-xs">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h1 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Plug className="h-4 w-4 text-indigo-400" />
            <span>SaaS Integrations & Connectors</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">Index live content across enterprise data sources</p>
        </div>

        <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400">
          Auto-Sync Active
        </Badge>
      </div>

      <div className="space-y-2.5">
        {items.map((conn) => (
          <Card key={conn.id} className="border-border bg-card/60">
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <span className="font-semibold text-xs text-foreground">{conn.name}</span>
              <Badge
                variant={conn.status === "connected" ? "default" : "secondary"}
                className={`text-[9px] ${conn.status === "connected" ? "bg-emerald-600 text-white" : ""}`}
              >
                {conn.status}
              </Badge>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Category: {conn.type}</span>
                <span>Indexed Docs: {conn.indexedDocs}</span>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Last Sync: {conn.lastSync}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant={conn.status === "connected" ? "outline" : "default"}
                  onClick={() => handleToggle(conn.id)}
                  className="flex-1 h-7 text-[10px]"
                >
                  {conn.status === "connected" ? "Disconnect" : "Connect"}
                </Button>
                {conn.status === "connected" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSync(conn.id)}
                    className="h-7 text-[10px]"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
