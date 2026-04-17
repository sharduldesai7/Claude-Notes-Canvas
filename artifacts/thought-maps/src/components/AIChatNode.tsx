import { useState, useRef, useEffect } from "react";
import { Node } from "@workspace/api-client-react";
import { useDrag } from "@use-gesture/react";
import { GripHorizontal, X, Sparkles, Loader2, Send, GripVertical } from "lucide-react";
import { motion } from "framer-motion";
import { useUpdateNode, useDeleteNode } from "@/hooks/use-nodes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

function parseChatHistory(raw: string | null | undefined): ChatMessage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ChatMessage[];
    return [];
  } catch {
    return [];
  }
}

interface AIChatNodeProps {
  node: Node;
  zoom: number;
  otherNodeIds: number[];
  onChat: (nodeId: number, message: string, onChunk: (t: string) => void, onDone: (history: ChatMessage[]) => void) => void;
  isStreaming: boolean;
  externalStreamingText?: string;
  /** Optimistic history from Canvas while DB refetch is in flight */
  pendingHistory?: ChatMessage[];
  readOnly?: boolean;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 400;
const MIN_WIDTH = 240;
const MIN_HEIGHT = 200;

export function AIChatNode({ node, zoom, otherNodeIds, onChat, isStreaming, externalStreamingText, pendingHistory, readOnly = false }: AIChatNodeProps) {
  const [pos, setPos] = useState({ x: node.positionX, y: node.positionY });
  const [messages, setMessages] = useState<ChatMessage[]>(() => parseChatHistory(node.chatHistory));
  const [streamingText, setStreamingText] = useState("");
  const [input, setInput] = useState("");
  const [cardWidth, setCardWidth] = useState(node.width || DEFAULT_WIDTH);
  const [cardHeight, setCardHeight] = useState(node.height || DEFAULT_HEIGHT);
  const cardWidthRef = useRef(cardWidth);
  const cardHeightRef = useRef(cardHeight);

  const lastSeenNodeId = useRef(node.id);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { mutate: updateNode } = useUpdateNode();
  const { mutate: deleteNode } = useDeleteNode();

  useEffect(() => {
    setPos({ x: node.positionX, y: node.positionY });
  }, [node.positionX, node.positionY]);

  useEffect(() => {
    if (node.width) { setCardWidth(node.width); cardWidthRef.current = node.width; }
    if (node.height) { setCardHeight(node.height); cardHeightRef.current = node.height; }
  }, [node.width, node.height]);

  // Sync messages whenever chatHistory changes from server (handles node.id change AND
  // the case where DB refetch populates chatHistory after a bar-initiated stream)
  useEffect(() => {
    const parsed = parseChatHistory(node.chatHistory);
    if (node.id !== lastSeenNodeId.current) {
      // Node switched — always re-initialize
      setMessages(parsed);
      lastSeenNodeId.current = node.id;
    } else if (parsed.length > messages.length) {
      // Server has more messages than local state — sync up (refetch landed)
      setMessages(parsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.chatHistory]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, streamingText]);

  const bindDrag = useDrag(({ offset: [ox, oy], last, event }) => {
    event.stopPropagation();
    setPos({ x: ox, y: oy });
    if (last) {
      updateNode({ mapId: node.mapId, nodeId: node.id, data: { positionX: ox, positionY: oy } });
    }
  }, {
    from: () => [pos.x, pos.y],
    transform: ([x, y]) => [x / zoom, y / zoom],
  });

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = cardWidthRef.current;
    const startHeight = cardHeightRef.current;

    const onMove = (ev: MouseEvent) => {
      ev.stopPropagation();
      const nextW = Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX) / zoom);
      const nextH = Math.max(MIN_HEIGHT, startHeight + (ev.clientY - startY) / zoom);
      setCardWidth(nextW);
      setCardHeight(nextH);
      cardWidthRef.current = nextW;
      cardHeightRef.current = nextH;
    };

    const onUp = (ev: MouseEvent) => {
      const finalW = Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX) / zoom);
      const finalH = Math.max(MIN_HEIGHT, startHeight + (ev.clientY - startY) / zoom);
      setCardWidth(finalW);
      setCardHeight(finalH);
      cardWidthRef.current = finalW;
      cardHeightRef.current = finalH;
      updateNode({
        mapId: node.mapId,
        nodeId: node.id,
        data: { width: Math.round(finalW), height: Math.round(finalH) },
      });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    onChat(
      node.id,
      text,
      (chunk) => setStreamingText((t) => t + chunk),
      (updatedHistory) => {
        setMessages(updatedHistory);
        setStreamingText("");
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      data-node-card="true"
      className="absolute rounded-2xl shadow-lg border border-primary/30 flex flex-col group hover:shadow-xl transition-shadow bg-card"
      style={{ width: cardWidth, height: cardHeight, x: pos.x, y: pos.y, touchAction: "none" }}
    >
      {/* Delete — hidden in read-only mode */}
      {!readOnly && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-3 -right-3 w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
          onClick={(e) => { e.stopPropagation(); deleteNode({ mapId: node.mapId, nodeId: node.id }); }}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}

      {/* Drag handle */}
      <div
        {...bindDrag()}
        className="h-9 bg-primary/10 rounded-t-2xl border-b border-primary/20 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary tracking-wide">AI Chat</span>
        </div>
        <GripHorizontal className="w-4 h-4 text-primary/40" />
      </div>

      {/* Messages — use pendingHistory as optimistic fallback while DB refetch is in flight */}
      <div data-chat-scroll className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2" onPointerDown={(e) => e.stopPropagation()}>
        {(messages.length > 0 ? messages : (pendingHistory ?? [])).map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed font-serif",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              )}
            >
              {msg.text.split("\n").map((line, j) => (
                <p key={j} className="min-h-[1em]">{line}</p>
              ))}
            </div>
          </div>
        ))}

        {/* Streaming assistant bubble (local or from bar) */}
        {(streamingText || externalStreamingText) && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-sm bg-muted text-foreground text-sm leading-relaxed font-serif">
              {(streamingText || externalStreamingText || "").split("\n").map((line, j) => (
                <p key={j} className="min-h-[1em]">{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {isStreaming && !streamingText && !externalStreamingText && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-muted flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking…
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input — hidden in read-only mode */}
      {!readOnly && (
        <div className="border-t border-border/50 p-2 flex items-end gap-2 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 80)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Continue chatting…"
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground font-serif leading-relaxed min-h-[28px] max-h-20"
          />
          <Button
            size="icon"
            className="h-7 w-7 rounded-full shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Send className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Resize grip — hidden in read-only mode */}
      {!readOnly && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center cursor-se-resize opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity"
          title="Drag to resize"
        >
          <GripVertical className="w-3.5 h-3.5 rotate-45 text-primary/60" />
        </div>
      )}
    </motion.div>
  );
}
