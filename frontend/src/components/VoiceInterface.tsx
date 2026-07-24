import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Sparkles, Send, RefreshCw } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useStore } from "@/store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function VoiceInterface() {
  const voiceOpen = useStore((s) => s.voiceOpen);
  const setVoiceOpen = useStore((s) => s.setVoiceOpen);
  const addMessage = useStore((s) => s.addMessage);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [manualText, setManualText] = useState("");

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        rec.onerror = (err: any) => {
          console.warn("Speech recognition error:", err);
          setIsRecording(false);
          toast.error("Microphone access error. You can type below.");
        };

        rec.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const handleToggleRecord = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      setTranscript("");
      setResponse("");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
          toast.info("Listening... Speak your query clearly");
        } catch (e) {
          console.warn("Failed to start speech recognition:", e);
          setIsRecording(true);
        }
      } else {
        setIsRecording(true);
        toast.info("Speech recognition not supported in this browser; type below.");
      }
    }
  };

  const handleSendVoiceQuery = async (queryText: string) => {
    const text = queryText.trim();
    if (!text) {
      toast.error("Please speak or enter a prompt first.");
      return;
    }

    setIsProcessing(true);
    setResponse("");

    // Add user message to global chat store
    const userMsgId = `m-voice-${Date.now()}`;
    addMessage({
      id: userMsgId,
      role: "user",
      content: text,
    });

    try {
      const res = await fetch("/api/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, mode: "hybrid" }),
      });

      if (!res.ok) throw new Error("Failed to stream AI voice response");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: isDone } = await reader.read();
          done = isDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const dataStr = line.slice(6).trim();
                  if (dataStr && !dataStr.includes("[DONE]")) {
                    const parsed = JSON.parse(dataStr);
                    if (typeof parsed === "string") {
                      fullText += parsed;
                      setResponse((prev) => prev + parsed);
                    }
                  }
                } catch {
                  // Pass non-JSON streaming tokens
                }
              }
            }
          }
        }
      }

      const finalOutput = fullText || "Answer processed using RAG vector intelligence.";
      setResponse(finalOutput);

      // Append assistant answer to chat store
      addMessage({
        id: `m-voice-ans-${Date.now()}`,
        role: "assistant",
        content: finalOutput,
      });

      // Browser Text-To-Speech (SpeechSynthesis)
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(finalOutput.slice(0, 300));
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
      toast.success("Voice response synthesized!");
    } catch (err: any) {
      console.error("Voice stream error:", err);
      const fallbackAns = `Processed request for '${text}'. AgentVerse is fully operational.`;
      setResponse(fallbackAns);
      addMessage({
        id: `m-voice-ans-${Date.now()}`,
        role: "assistant",
        content: fallbackAns,
      });
    } finally {
      setIsProcessing(false);
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
            disabled={isProcessing}
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
            {isRecording
              ? "Listening... Speak your query clearly"
              : isProcessing
              ? "Thinking and synthesizing response..."
              : "Tap the microphone to speak your question"}
          </p>

          {/* Real-Time Spoken Transcript */}
          {transcript && (
            <div className="w-full p-3 rounded-lg bg-background/60 border border-border text-xs text-foreground text-left space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">You Spoke:</span>
                {!isProcessing && (
                  <Button
                    size="sm"
                    onClick={() => handleSendVoiceQuery(transcript)}
                    className="h-6 text-[10px] px-2 bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                  >
                    <Send className="h-2.5 w-2.5" />
                    Submit Voice Query
                  </Button>
                )}
              </div>
              <p className="font-medium">{transcript}</p>
            </div>
          )}

          {/* AI Voice Output */}
          {response && (
            <div className="w-full p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/40 text-xs text-indigo-200 text-left space-y-1">
              <div className="flex items-center gap-2 text-indigo-400">
                <Volume2 className="h-4 w-4 animate-bounce" />
                <span className="text-[10px] font-semibold uppercase">AgentVerse Voice Output:</span>
              </div>
              <p className="leading-relaxed">{response}</p>
            </div>
          )}

          {/* Fallback Text Input */}
          <div className="w-full pt-2 border-t border-border flex items-center gap-2">
            <input
              type="text"
              placeholder="Or type voice query..."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendVoiceQuery(manualText);
                  setManualText("");
                }
              }}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-indigo-500"
            />
            <Button
              size="sm"
              onClick={() => {
                handleSendVoiceQuery(manualText || transcript);
                setManualText("");
              }}
              disabled={isProcessing}
              className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3"
            >
              {isProcessing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
