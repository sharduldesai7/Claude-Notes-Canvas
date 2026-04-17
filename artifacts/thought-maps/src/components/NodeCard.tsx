import { useState, useEffect, useRef, useCallback } from "react";
import { Node } from "@workspace/api-client-react";
import { useDrag } from "@use-gesture/react";
import { GripHorizontal, X, Sparkles, Loader2, Palette, GripVertical, ImageIcon, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUpdateNode, useDeleteNode } from "@/hooks/use-nodes";
import { useAskClaudeStream } from "@/hooks/use-ask-claude";
import { useImageUpload } from "@/hooks/use-image-upload";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface NodeCardProps {
  node: Node;
  zoom: number;
  otherNodeIds: number[];
  readOnly?: boolean;
}

interface ClaudeEntry {
  question: string;
  answer: string;
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

function parseHistory(raw: string | null | undefined): ClaudeEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ClaudeEntry[];
    return [{ question: '', answer: String(raw) }];
  } catch {
    return [{ question: '', answer: raw }];
  }
}

export function NodeCard({ node, zoom, otherNodeIds, readOnly = false }: NodeCardProps) {
  const [pos, setPos] = useState({ x: node.positionX, y: node.positionY });
  const [content, setContent] = useState(node.content);
  const [title, setTitle] = useState(node.title || "");
  const [editingTitle, setEditingTitle] = useState(false);

  const [history, setHistory] = useState<ClaudeEntry[]>(() => parseHistory(node.claudeResponse));
  const lastSeenNodeId = useRef(node.id);
  const [streamingText, setStreamingText] = useState("");

  const [cardColor, setCardColor] = useState(node.color || '#FFFFFF');
  const [cardWidth, setCardWidth] = useState(node.width || DEFAULT_WIDTH);
  const cardWidthRef = useRef(cardWidth);

  const [nodeImageUrl, setNodeImageUrl] = useState<string | null | undefined>(node.imageUrl);
  const [isDragOver, setIsDragOver] = useState(false);

  const { mutate: updateNode } = useUpdateNode();
  const { mutate: deleteNode } = useDeleteNode();
  const { generate, isGenerating } = useAskClaudeStream();
  const { upload, isUploading } = useImageUpload();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPos({ x: node.positionX, y: node.positionY });
  }, [node.positionX, node.positionY]);

  useEffect(() => {
    setContent(node.content);
    if (node.color) setCardColor(node.color);
    if (node.width) {
      setCardWidth(node.width);
      cardWidthRef.current = node.width;
    }
    setNodeImageUrl(node.imageUrl);
    if (lastSeenNodeId.current !== node.id) {
      setHistory(parseHistory(node.claudeResponse));
      setTitle(node.title || "");
      lastSeenNodeId.current = node.id;
    }
  }, [node.id, node.content, node.claudeResponse, node.color, node.width, node.title, node.imageUrl]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [history, streamingText]);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };
  useEffect(() => { autoResize(); }, [content]);

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

  const handleTitleBlur = () => {
    setEditingTitle(false);
    const trimmed = title.trim() || node.title || "Untitled";
    if (trimmed !== node.title) {
      updateNode({ mapId: node.mapId, nodeId: node.id, data: { title: trimmed } });
    }
  };

  const handleColorChange = (color: string) => {
    setCardColor(color);
    updateNode({ mapId: node.mapId, nodeId: node.id, data: { color } });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const objectPath = await upload(file);
    if (objectPath) {
      setNodeImageUrl(objectPath);
      updateNode({ mapId: node.mapId, nodeId: node.id, data: { imageUrl: objectPath } });
    }
  };

  const handleRemoveImage = () => {
    setNodeImageUrl(null);
    updateNode({ mapId: node.mapId, nodeId: node.id, data: { imageUrl: null } });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    const hasFiles = Array.from(e.dataTransfer.types).includes('Files');
    if (!hasFiles) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [readOnly]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, [readOnly]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const objectPath = await upload(file);
    if (objectPath) {
      setNodeImageUrl(objectPath);
      updateNode({ mapId: node.mapId, nodeId: node.id, data: { imageUrl: objectPath } });
    }
  }, [readOnly, upload, updateNode, node.mapId, node.id]);

  const handleAskClaude = async (question: string) => {
    let accumulated = "";
    setStreamingText("");

    await generate(node.mapId, node.id, question, (chunk) => {
      accumulated += chunk;
      setStreamingText(accumulated);
    }, otherNodeIds);

    const newEntry: ClaudeEntry = { question, answer: accumulated };
    setHistory((prev) => {
      const updated = [...prev, newEntry];
      updateNode({
        mapId: node.mapId,
        nodeId: node.id,
        data: { claudeResponse: JSON.stringify(updated), isProcessing: false },
      });
      return updated;
    });
    setStreamingText("");
  };

  const showChatSection = history.length > 0 || isGenerating;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      data-node-card="true"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "absolute rounded-2xl shadow-lg border flex flex-col group hover:shadow-xl transition-shadow",
        isDragOver
          ? "border-primary/60 ring-2 ring-primary/30 shadow-xl"
          : "border-border/50"
      )}
      style={{
        width: cardWidth,
        x: pos.x,
        y: pos.y,
        backgroundColor: isDragOver
          ? cardColor === '#FFFFFF' ? 'hsl(var(--primary)/0.04)' : cardColor
          : cardColor === '#FFFFFF' ? 'hsl(var(--card))' : cardColor,
        touchAction: 'none',
      }}
    >
      {/* Drop overlay */}
      {isDragOver && !readOnly && (
        <div className="absolute inset-0 z-30 rounded-2xl flex flex-col items-center justify-center gap-2 bg-primary/5 pointer-events-none">
          <ImageIcon className="w-8 h-8 text-primary/60" />
          <span className="text-xs font-medium text-primary/70">Drop image here</span>
        </div>
      )}

      {/* Delete button — hidden in read-only mode */}
      {!readOnly && (
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
      )}

      {/* Drag handle */}
      <div
        {...bindDrag()}
        className="h-8 bg-black/5 rounded-t-2xl border-b border-black/10 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-black/10 transition-colors relative"
      >
        <GripHorizontal className="w-5 h-5 text-foreground/40" />

        <div className="absolute left-2 flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
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
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5 rounded-full hover:bg-black/10"
              title={nodeImageUrl ? "Replace image" : "Attach image"}
              disabled={isUploading}
              onClick={() => imageInputRef.current?.click()}
            >
              {isUploading ? <Loader2 className="w-3 h-3 animate-spin text-foreground/50" /> : <ImageIcon className="w-3 h-3 text-foreground/50" />}
            </Button>
          )}
        </div>

        {isGenerating && (
          <div className="absolute right-2">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
          </div>
        )}
      </div>

      {/* Editable title — static in read-only mode */}
      <div
        className="px-4 pt-3 pb-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {!readOnly && editingTitle ? (
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                titleInputRef.current?.blur();
              }
            }}
            className="w-full bg-transparent border-none outline-none text-xs font-semibold text-foreground/60 placeholder:text-foreground/30 tracking-wide"
            autoFocus
          />
        ) : (
          <button
            className={cn(
              "text-xs font-semibold text-foreground/40 tracking-wide text-left truncate w-full",
              !readOnly && "hover:text-foreground/70 transition-colors cursor-pointer",
              readOnly && "cursor-default"
            )}
            onClick={() => {
              if (readOnly) return;
              setEditingTitle(true);
              setTimeout(() => titleInputRef.current?.select(), 0);
            }}
          >
            {title || "Untitled"}
          </button>
        )}
      </div>

      {/* Chat history */}
      <AnimatePresence>
        {showChatSection && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            data-chat-scroll
            className="border-b border-black/10 bg-black/5 px-5 pt-4 pb-3 flex flex-col gap-4 max-h-96 overflow-y-auto mt-3"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary/70" />
              <span className="text-xs font-semibold text-primary/70 uppercase tracking-wide">Claude</span>
            </div>

            {history.map((entry, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                {entry.question && (
                  <p className="text-xs text-foreground/50 font-medium italic">{entry.question}</p>
                )}
                <div className="text-sm text-foreground/90 font-serif leading-relaxed">
                  {entry.answer.split('\n').map((line, j) => (
                    <p key={j} className="min-h-[1em]">{line}</p>
                  ))}
                </div>
                {i < history.length - 1 && <hr className="border-black/10 mt-1" />}
              </div>
            ))}

            {isGenerating && (
              <div className="flex flex-col gap-1.5">
                {history.length > 0 && <hr className="border-black/10" />}
                {streamingText.length === 0 ? (
                  <div className="flex items-center gap-2 text-foreground/50 text-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Thinking…</span>
                  </div>
                ) : (
                  <div className="text-sm text-foreground/90 font-serif leading-relaxed">
                    {streamingText.split('\n').map((line, j) => (
                      <p key={j} className="min-h-[1em]">{line}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image attachment display */}
      {nodeImageUrl && (
        <div className="relative mx-4 mt-1 mb-0" onPointerDown={(e) => e.stopPropagation()}>
          <img
            src={`/api/storage${nodeImageUrl}`}
            alt="Attached"
            className="w-full rounded-xl object-cover max-h-48"
          />
          {!readOnly && (
            <button
              onClick={handleRemoveImage}
              className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Note textarea — read-only when in view-only mode */}
      <div className="px-4 pt-2 pb-4 flex flex-col">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => !readOnly && setContent(e.target.value)}
          onBlur={!readOnly ? handleContentBlur : undefined}
          onPointerDown={(e) => e.stopPropagation()}
          readOnly={readOnly}
          className={cn(
            "w-full bg-transparent border-none outline-none resize-none min-h-[40px] text-base text-foreground placeholder:text-foreground/50 font-serif leading-relaxed",
            readOnly && "cursor-default"
          )}
          placeholder={readOnly ? "" : "Jot a thought…"}
        />
      </div>

      {/* Hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Resize grip — hidden in read-only mode */}
      {!readOnly && <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center cursor-se-resize opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity"
        title="Drag to resize"
      >
        <GripVertical className="w-3.5 h-3.5 rotate-45 text-foreground/60" />
      </div>}
    </motion.div>
  );
}
