import { useState } from "react";
import { Mic, MicOff, Volume2, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useStore } from "@/store";
import { toast } from "sonner";

export function VoiceInterface() {
  const voiceOpen = useStore((s) => s.voiceOpen);
  const setVoiceOpen = useStore((s) => s.setVoiceOpen);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");

  const handleToggleRecord = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTranscript("Listening...");
      setResponse("");

      setTimeout(() => {
        setTranscript("What are the key conclusions from the architectural security evaluation?");
      }, 1500);

      setTimeout(() => {
        setIsRecording(false);
        setResponse("The security architecture enforces Zero-Trust RBAC, AES-256 document encryption at rest, and full audit logging across all LLM tool calls.");
        toast.success("Synthesized voice answer!");
      }, 3000);
    } else {
      setIsRecording(false);
    }
  };

  return (
    <Dialog open={voiceOpen} onOpenChange={setVoiceOpen}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border">
        <div className="flex flex-col items-center justify-center p-6 space-y-6 text-center select-none">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <h3 className="font-bold text-base text-foreground">Streaming Voice AI Workspace</h3>
          </div>

          <button
            onClick={handleToggleRecord}
            className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 ${
              isRecording
                ? "bg-red-500 text-white shadow-xl shadow-red-500/50 scale-105"
                : "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/30 hover:scale-105"
            }`}
          >
            {isRecording ? <MicOff className="h-10 w-10 animate-pulse" /> : <Mic className="h-10 w-10" />}
            {isRecording && (
              <span className="absolute -inset-2 rounded-full border-2 border-red-500/50 animate-ping" />
            )}
          </button>

          <p className="text-xs text-muted-foreground">
            {isRecording ? "Listening... Speak your query clearly" : "Tap the microphone to start voice conversation"}
          </p>

          {transcript && (
            <div className="w-full p-3 rounded-lg bg-background/60 border border-border text-xs text-foreground text-left space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase">You said:</span>
              <p>{transcript}</p>
            </div>
          )}

          {response && (
            <div className="w-full p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/30 text-xs text-indigo-200 text-left space-y-1">
              <div className="flex items-center gap-2 text-indigo-400">
                <Volume2 className="h-4 w-4 animate-bounce" />
                <span className="text-[10px] font-semibold uppercase">AgentVerse Voice Output:</span>

              </div>
              <p>{response}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
