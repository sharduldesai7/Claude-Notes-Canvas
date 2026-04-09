import { useState, useRef } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AIChatBarProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
}

export function AIChatBar({ onSend, isStreaming }: AIChatBarProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-5 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-xl mx-6 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl shadow-black/15 flex items-end gap-2 px-4 py-2.5"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Sparkles icon */}
        <div className={cn(
          "shrink-0 w-7 h-7 rounded-xl flex items-center justify-center mb-0.5 transition-colors",
          isStreaming ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary/70"
        )}>
          {isStreaming
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Sparkles className="w-3.5 h-3.5" />
          }
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude anything — creates a new AI chat note…"
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground font-serif leading-relaxed min-h-[28px] max-h-[120px] py-0.5"
          disabled={isStreaming}
        />

        {/* Send button */}
        <Button
          size="icon"
          className="h-7 w-7 rounded-xl shrink-0 mb-0.5"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
