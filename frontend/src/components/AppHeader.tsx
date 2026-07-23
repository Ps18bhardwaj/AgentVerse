import { Sparkles } from "lucide-react";

export function AppHeader() {
  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4 text-xs font-semibold">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-400" />
        <span>AgentVerse Enterprise</span>

      </div>
    </header>
  );
}
