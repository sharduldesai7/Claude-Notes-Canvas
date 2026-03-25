import { useState, useEffect, useRef } from "react";
import { Node } from "@workspace/api-client-react";
import { useDrag } from "@use-gesture/react";
import { GripHorizontal, X, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUpdateNode, useDeleteNode } from "@/hooks/use-nodes";
import { useAskClaudeStream } from "@/hooks/use-ask-claude";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NodeCardProps {
  node: Node;
  onConnectionStart: (nodeId: number, x: number, y: number) => void;
  onConnectionEnd: (nodeId: number) => void;
  zoom: number;
}

const CARD_WIDTH = 280;

export function NodeCard({ node, onConnectionStart, onConnectionEnd, zoom }: NodeCardProps) {
  const [pos, setPos] = useState({ x: node.positionX, y: node.positionY });
  const [content, setContent] = useState(node.content);
  const [claudeText, setClaudeText] = useState(node.claudeResponse || "");
  
  const { mutate: updateNode } = useUpdateNode();
  const { mutate: deleteNode } = useDeleteNode();
  const { generate, isGenerating } = useAskClaudeStream();
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external position changes
  useEffect(() => {
    setPos({ x: node.positionX, y: node.positionY });
  }, [node.positionX, node.positionY]);

  // Sync external content changes
  useEffect(() => {
    setContent(node.content);
    setClaudeText(node.claudeResponse || "");
  }, [node.content, node.claudeResponse]);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [content]);

  const bindDrag = useDrag(({ offset: [ox, oy], last, event }) => {
    event.stopPropagation();
    setPos({ x: ox, y: oy });
    if (last) {
      updateNode({ 
        mapId: node.mapId, 
        nodeId: node.id, 
        data: { positionX: ox, positionY: oy } 
      });
    }
  }, {
    from: () => [pos.x, pos.y],
    transform: ([x, y]) => [x / zoom, y / zoom],
  });

  const handleContentBlur = () => {
    if (content !== node.content) {
      updateNode({ mapId: node.mapId, nodeId: node.id, data: { content } });
    }
  };

  const handleAskClaude = async () => {
    if (!content.trim()) return;
    
    let accumulated = "";
    setClaudeText("");
    
    await generate(node.mapId, node.id, content, (chunk) => {
      accumulated += chunk;
      setClaudeText(accumulated);
    });
    
    updateNode({ 
      mapId: node.mapId, 
      nodeId: node.id, 
      data: { claudeResponse: accumulated, isProcessing: false } 
    });
  };

  const hasClaudeTrigger = content.toLowerCase().includes('/claude');
  const showClaudeBox = claudeText.length > 0 || isGenerating;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute bg-card rounded-2xl shadow-lg border border-border/50 flex flex-col group hover:shadow-xl transition-shadow"
      style={{
        width: CARD_WIDTH,
        x: pos.x,
        y: pos.y,
        touchAction: 'none'
      }}
    >
      {/* Delete button (shows on hover) */}
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

      {/* Drag Handle Area */}
      <div 
        {...bindDrag()}
        className="h-8 bg-muted/40 rounded-t-2xl border-b border-border/30 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-muted/60 transition-colors"
      >
        <GripHorizontal className="w-5 h-5 text-muted-foreground/40" />
      </div>

      {/* Content Area */}
      <div className="p-5 flex flex-col gap-3 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleContentBlur}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full bg-transparent border-none outline-none resize-none min-h-[40px] text-base text-foreground placeholder:text-muted-foreground/60 font-serif leading-relaxed"
          placeholder="Jot down a thought..."
        />

        <AnimatePresence>
          {hasClaudeTrigger && !showClaudeBox && !isGenerating && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex justify-end mt-1"
            >
              <Button 
                size="sm" 
                className="bg-accent hover:bg-accent/90 text-white rounded-full shadow-md px-4 py-1.5 h-auto text-xs font-semibold flex items-center gap-1.5"
                onClick={handleAskClaude}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ask Claude
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI Response Area */}
      <AnimatePresence>
        {showClaudeBox && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-accent/20 bg-gradient-to-b from-accent/5 to-transparent rounded-b-2xl p-5 relative"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 p-2">
               <Sparkles className="w-4 h-4 text-accent/40" />
            </div>
            
            {isGenerating && claudeText.length === 0 ? (
              <div className="flex items-center gap-2 text-accent text-sm font-medium py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            ) : (
              <div className="prose prose-sm prose-p:leading-relaxed prose-p:my-1 text-foreground/90 font-serif">
                {claudeText.split('\n').map((line, i) => (
                  <p key={i} className="min-h-[1em]">{line}</p>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection Handles */}
      <div 
        className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 bg-card border-2 border-primary rounded-full cursor-crosshair hover:scale-125 transition-transform flex items-center justify-center shadow-sm z-10"
        onPointerDown={(e) => {
          e.stopPropagation();
          onConnectionStart(node.id, pos.x, pos.y + 50); // approx middle
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          onConnectionEnd(node.id);
        }}
      >
        <div className="w-2 h-2 bg-primary rounded-full" />
      </div>

      <div 
        className="absolute right-[-12px] top-1/2 -translate-y-1/2 w-6 h-6 bg-card border-2 border-primary rounded-full cursor-crosshair hover:scale-125 transition-transform flex items-center justify-center shadow-sm z-10"
        onPointerDown={(e) => {
          e.stopPropagation();
          onConnectionStart(node.id, pos.x + CARD_WIDTH, pos.y + 50);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          onConnectionEnd(node.id);
        }}
      >
        <div className="w-2 h-2 bg-primary rounded-full" />
      </div>
    </motion.div>
  );
}
