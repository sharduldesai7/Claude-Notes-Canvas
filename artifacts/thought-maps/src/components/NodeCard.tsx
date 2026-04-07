import { useState, useEffect, useRef } from "react";
import { Node } from "@workspace/api-client-react";
import { useDrag } from "@use-gesture/react";
import { GripHorizontal, X, Sparkles, Loader2, Palette, GripVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUpdateNode, useDeleteNode } from "@/hooks/use-nodes";
import { useAskClaudeStream } from "@/hooks/use-ask-claude";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface NodeCardProps {
  node: Node;
  zoom: number;
  otherNodeIds: number[];
}

const MIN_WIDTH = 220;
const DEFAULT_WIDTH = 280;

const COLORS = [
  { name: 'white', value: '#FFFFFF' },
  { name: 'yellow', value: '#FFF9C4' },
  { name: 'pink', value: '#FCE4EC' },
  { name: 'blue', value: '#E3F2FD' },
  { name: 'green', value: '#E8F5E9' },
  { name: 'orange', value: '#FFF3E0' },
  { name: 'purple', value: '#EDE7F6' },
  { name: 'grey', value: '#F5F5F5' },
];

export function NodeCard({ node, zoom, otherNodeIds }: NodeCardProps) {
  const [pos, setPos] = useState({ x: node.positionX, y: node.positionY });
  const [content, setContent] = useState(node.content);
  const [claudeText, setClaudeText] = useState(node.claudeResponse || "");
  const [cardColor, setCardColor] = useState(node.color || '#FFFFFF');
  const [cardWidth, setCardWidth] = useState(node.width || DEFAULT_WIDTH);
  // Keep a ref so useDrag memo captures the initial width per gesture
  const cardWidthRef = useRef(cardWidth);

  const { mutate: updateNode } = useUpdateNode();
  const { mutate: deleteNode } = useDeleteNode();
  const { generate, isGenerating } = useAskClaudeStream();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPos({ x: node.positionX, y: node.positionY });
  }, [node.positionX, node.positionY]);

  useEffect(() => {
    setContent(node.content);
    setClaudeText(node.claudeResponse || "");
    if (node.color) setCardColor(node.color);
    if (node.width) {
      setCardWidth(node.width);
      cardWidthRef.current = node.width;
    }
  }, [node.content, node.claudeResponse, node.color, node.width]);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => { autoResize(); }, [content]);

  // ── Drag to move (grab handle only) ──────────────────────────────────
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

  // ── Resize via native mouse events ────────────────────────────────────
  // Native mouse handlers work reliably without pointer-capture conflicts with the canvas pan.
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = cardWidthRef.current;

    const onMove = (ev: MouseEvent) => {
      ev.stopPropagation();
      const dx = (ev.clientX - startX) / zoom;
      const next = Math.max(MIN_WIDTH, startWidth + dx);
      setCardWidth(next);
      cardWidthRef.current = next;
    };

    const onUp = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const final = Math.max(MIN_WIDTH, startWidth + dx);
      setCardWidth(final);
      cardWidthRef.current = final;
      updateNode({ mapId: node.mapId, nodeId: node.id, data: { width: Math.round(final) } });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleContentBlur = () => {
    if (content !== node.content) {
      updateNode({ mapId: node.mapId, nodeId: node.id, data: { content } });
    }
  };

  const handleColorChange = (color: string) => {
    setCardColor(color);
    updateNode({ mapId: node.mapId, nodeId: node.id, data: { color } });
  };

  // ── Claude invocation ─────────────────────────────────────────────────
  const handleAskClaude = async (prompt: string) => {
    let accumulated = "";
    setClaudeText("");
    await generate(node.mapId, node.id, prompt, (chunk) => {
      accumulated += chunk;
      setClaudeText(accumulated);
    }, otherNodeIds);

    updateNode({
      mapId: node.mapId,
      nodeId: node.id,
      data: { claudeResponse: accumulated, isProcessing: false },
    });
  };

  // Enter (not Shift+Enter) on a line starting with /claude → invoke Claude
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const lines = content.split('\n');
      const lastLine = lines[lines.length - 1];
      if (lastLine.toLowerCase().startsWith('/claude')) {
        e.preventDefault();
        const prompt = lastLine.replace(/^\/claude\s*/i, '').trim();
        if (!prompt) return;
        const newContent = lines.slice(0, -1).join('\n');
        setContent(newContent);
        updateNode({ mapId: node.mapId, nodeId: node.id, data: { content: newContent } });
        handleAskClaude(prompt);
      }
    }
  };

  const showClaudeBox = claudeText.length > 0 || isGenerating;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      data-node-card="true"
      className="absolute rounded-2xl shadow-lg border border-border/50 flex flex-col group hover:shadow-xl transition-shadow"
      style={{
        width: cardWidth,
        x: pos.x,
        y: pos.y,
        backgroundColor: cardColor === '#FFFFFF' ? 'hsl(var(--card))' : cardColor,
        touchAction: 'none',
      }}
    >
      {/* Delete button */}
      <Button
        variant="destructive"
        size="icon"
        className="absolute -top-3 -right-3 w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
        onClick={(e) => {
          e.stopPropagation();
          deleteNode({ mapId: node.mapId, nodeId: node.id });
        }}
      >
        <X className="w-3.5 h-3.5" />
      </Button>

      {/* ── Drag handle ───────────────────────────────────────────── */}
      <div
        {...bindDrag()}
        className="h-8 bg-black/5 rounded-t-2xl border-b border-black/10 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-black/10 transition-colors relative"
      >
        <GripHorizontal className="w-5 h-5 text-foreground/40" />

        {/* Color picker */}
        <div className="absolute left-2" onPointerDown={(e) => e.stopPropagation()}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5 rounded-full hover:bg-black/10"
                style={{ backgroundColor: cardColor === '#FFFFFF' ? 'transparent' : cardColor }}
              >
                {cardColor === '#FFFFFF' && <Palette className="w-3 h-3 text-foreground/50" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="grid grid-cols-4 gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.name}
                    className={cn(
                      "w-6 h-6 rounded-full border border-black/10 hover:scale-110 transition-transform",
                      cardColor === color.value && "ring-2 ring-primary ring-offset-1"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => handleColorChange(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {isGenerating && (
          <div className="absolute right-2">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
          </div>
        )}
      </div>

      {/* ── Claude response (above textarea) ──────────────────────── */}
      <AnimatePresence>
        {showClaudeBox && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-black/10 bg-black/5 px-5 py-4 relative overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary/70" />
              <span className="text-xs font-semibold text-primary/70 uppercase tracking-wide">Claude</span>
            </div>

            {isGenerating && claudeText.length === 0 ? (
              <div className="flex items-center gap-2 text-foreground/70 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking…
              </div>
            ) : (
              <div className="text-sm text-foreground/90 font-serif leading-relaxed max-h-64 overflow-y-auto">
                {claudeText.split('\n').map((line, i) => (
                  <p key={i} className="min-h-[1em]">{line}</p>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Note textarea (always at bottom) ──────────────────────── */}
      <div className="p-5 flex flex-col">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleContentBlur}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full bg-transparent border-none outline-none resize-none min-h-[40px] text-base text-foreground placeholder:text-foreground/50 font-serif leading-relaxed"
          placeholder={showClaudeBox
            ? "Continue writing below Claude's response…"
            : "Jot a thought… or type /claude <question> and press Enter"
          }
        />
      </div>

      {/* ── Resize grip (bottom-right) ─────────────────────────────────── */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center cursor-se-resize opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity"
        title="Drag to resize"
      >
        <GripVertical className="w-3.5 h-3.5 rotate-45 text-foreground/60" />
      </div>
    </motion.div>
  );
}
