import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useApplyTheme } from "@/lib/theme";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useStore } from "@/store";
import { getMe } from "@/lib/api";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatPanel } from "./components/ChatPanel";
import { RightContextualPanel } from "./components/RightContextualPanel";
import { DocumentsPanel } from "./components/DocumentsPanel";
import { VoiceInterface } from "./components/VoiceInterface";
import { CommandPalette } from "./components/CommandPalette";
import { AuthView } from "./components/auth/AuthView";
import { UserProfileModal } from "./components/profile/UserProfileModal";
import { AdminPanelModal } from "./components/admin/AdminPanelModal";
import { Loader2 } from "lucide-react";

export default function App() {
  useApplyTheme();
  useKeyboardShortcuts();

  const authStatus = useStore((s) => s.authStatus);
  const setAuthStatus = useStore((s) => s.setAuthStatus);
  const setUser = useStore((s) => s.setUser);
  const docsOpen = useStore((s) => s.docsOpen);
  const setDocsOpen = useStore((s) => s.setDocsOpen);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    // Check initial authentication session on app load
    const checkAuthSession = async () => {
      try {
        const user = await getMe();
        setUser(user);
        setAuthStatus("authenticated");
      } catch {
        setUser(null);
        setAuthStatus("unauthenticated");
      }
    };
    checkAuthSession();
  }, [setUser, setAuthStatus]);

  if (authStatus === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground select-none">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-medium">Verifying Security Session...</span>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <TooltipProvider delayDuration={200}>
        <AuthView />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground select-none">
        {/* Left Conversational Navigation Sidebar */}
        <ChatSidebar />

        {/* Center Main Screen: Conversational AI Workspace */}
        <div className="flex flex-1 min-w-0 h-full overflow-hidden relative">
          <ChatPanel />

          {/* Dynamic Right Contextual Side Panel */}
          <RightContextualPanel />
        </div>
      </div>

      {/* Scoped Documents Sheet Overlay on mobile */}
      <Sheet open={docsOpen && !isDesktop} onOpenChange={setDocsOpen}>
        <SheetContent side="left" className="w-80 gap-0 p-0">
          <SheetTitle className="sr-only">Scoped Documents</SheetTitle>
          <DocumentsPanel />
        </SheetContent>
      </Sheet>

      {/* Voice, Command Palette, Profile & Admin Panel Modals */}
      <VoiceInterface />
      <CommandPalette />
      <UserProfileModal />
      <AdminPanelModal />

      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
