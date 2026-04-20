import { useState, useRef, useCallback, useEffect } from "react";
import { useGesture } from "@use-gesture/react";
import { ThoughtMapFull, Node } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetThoughtMapQueryKey } from "@workspace/api-client-react";
import { useCreateNode } from "@/hooks/use-nodes";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatMessage } from "./AIChatNode";
import { RemoteCursor } from "@/hooks/use-realtime-sync";
import { LayoutTemplate, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { NodeCard } from "./NodeCard";
import { AIChatNode } from "./AIChatNode";
import { AIChatBar } from "./AIChatBar";

interface CanvasProps {
  map: ThoughtMapFull;
  readOnly?: boolean;
  remoteCursors?: Record<string, RemoteCursor>;
  sendCursorMove?: (x: number, y: number) => void;
}

export function Canvas({
  map,
  readOnly = false,
  remoteCursors = {},
  sendCursorMove,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCursorSend = useRef(0);

  // Track whether the current drag gesture started on the canvas background
  const dragStartedOnCanvas = useRef(false);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Per-node streaming text (for AI chat nodes)
  const [nodeStreamingTexts, setNodeStreamingTexts] = useState<Record<number, string>>({});
  // Holds the final chat history optimistically until the DB refetch lands
  const [nodePendingHistories, setNodePendingHistories] = useState<Record<number, ChatMessage[]>>({});

  const { mutateAsync: createNodeAsync } = useCreateNode();
  const { sendMessage, streamingNodeId } = useChatStream();
  const queryClient = useQueryClient();
  const [isOrganizing, setIsOrganizing] = useState(false);
  const fitAfterOrganizeRef = useRef(false);

  const fitToNodes = useCallback(() => {
    if (!containerRef.current) return;
    const nodes = map.nodes.filter(n => n.nodeType === "note" || n.nodeType === "ai_chat");
    if (nodes.length === 0) return;

    const PADDING = 60;
    const rect = containerRef.current.getBoundingClientRect();

    const minX = Math.min(...nodes.map(n => n.positionX));
    const minY = Math.min(...nodes.map(n => n.positionY));
    const maxX = Math.max(...nodes.map(n => n.positionX + (n.width  || (n.nodeType === "ai_chat" ? 320 : 280))));
    const maxY = Math.max(...nodes.map(n => n.positionY + (n.height || (n.nodeType === "ai_chat" ? 400 : 220))));

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) return;

    const newZoom = Math.min(
      (rect.width  - 2 * PADDING) / contentW,
      (rect.height - 2 * PADDING) / contentH,
      1,   // never zoom in past 100%
    );
    const clampedZoom = Math.max(0.15, newZoom);

    // Centre the content inside the viewport
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setPan({
      x: rect.width  / 2 - centerX * clampedZoom,
      y: rect.height / 2 - centerY * clampedZoom,
    });
    setZoom(clampedZoom);
  }, [map.nodes]);

  // Fire fit-to-nodes once whenever an organize completes and map data refreshes
  useEffect(() => {
    if (!fitAfterOrganizeRef.current) return;
    fitAfterOrganizeRef.current = false;
    fitToNodes();
  }, [map.nodes, fitToNodes]);

  const handleOrganize = useCallback(async () => {
    if (isOrganizing) return;
    setIsOrganizing(true);
    try {
      const res = await fetch(`/api/thought-maps/${map.id}/organize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        fitAfterOrganizeRef.current = true;
        await queryClient.refetchQueries({ queryKey: getGetThoughtMapQueryKey(map.id) });
      }
    } finally {
      setIsOrganizing(false);
    }
  }, [isOrganizing, map.id, queryClient]);

  // When server data lands (map.nodes updates), clear pendingHistory for nodes that now have chatHistory
  useEffect(() => {
    setNodePendingHistories((prev) => {
      const pendingIds = Object.keys(prev).map(Number);
      if (pendingIds.length === 0) return prev;
      const toRemove = pendingIds.filter((id) => {
        const node = map.nodes.find((n) => n.id === id);
        return node?.chatHistory && node.chatHistory.length > 0;
      });
      if (toRemove.length === 0) return prev;
      const next = { ...prev };
      toRemove.forEach((id) => delete next[id]);
      return next;
    });
  }, [map.nodes]);

  useGesture(
    {
      onDrag: ({ delta: [dx, dy], pinching, first, event }) => {
        if (pinching) return;
        // On the first event of each drag gesture, decide if it's a canvas drag
        if (first) {
          const target = event.target as HTMLElement;
          dragStartedOnCanvas.current = !target.closest('[data-node-card]');
        }
        if (!dragStartedOnCanvas.current) return;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      },
      onWheel: ({ delta: [dx, dy], ctrlKey, event }) => {
        // If the wheel originated inside a scrollable chat area, let it scroll naturally
        const target = event.target as HTMLElement;
        if (target.closest('[data-chat-scroll]')) return;
        event.preventDefault();
        if (ctrlKey) {
          setZoom((z) => Math.max(0.2, Math.min(3, z - dy * 0.01)));
        } else {
          setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
        }
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      drag: { filterTaps: true },
    }
  );

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (readOnly) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-node-card]')) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    createNodeAsync({
      mapId: map.id,
      data: { content: "", positionX: Math.round(x - 140), positionY: Math.round(y - 50) },
    });
  };

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!sendCursorMove) return;
    const now = Date.now();
    if (now - lastCursorSend.current < 40) return; // throttle ~25fps
    lastCursorSend.current = now;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldX = (e.clientX - rect.left - pan.x) / zoom;
    const worldY = (e.clientY - rect.top - pan.y) / zoom;
    sendCursorMove(worldX, worldY);
  }, [sendCursorMove, pan, zoom]);

  // Called by AIChatBar — creates a new ai_chat node, then starts chat stream
  const handleBarSend = useCallback(async (message: string) => {
    if (!containerRef.current) return;

    // Place new node in the center of the current viewport
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (rect.width / 2 - pan.x) / zoom;
    const cy = (rect.height / 2 - pan.y) / zoom;

    // Scatter slightly so multiple nodes don't stack
    const scatter = () => (Math.random() - 0.5) * 200;

    const newNode = await createNodeAsync({
      mapId: map.id,
      data: {
        nodeType: "ai_chat",
        content: "",
        positionX: Math.round(cx - 160 + scatter()),
        positionY: Math.round(cy - 120 + scatter()),
        width: 320,
        height: 400,
      },
    });

    if (!newNode?.id) return;

    const nodeId = newNode.id;
    const otherNodeIds = map.nodes.map((n) => n.id);

    setNodeStreamingTexts((prev) => ({ ...prev, [nodeId]: "" }));

    await sendMessage(
      map.id,
      nodeId,
      message,
      otherNodeIds,
      (chunk) => {
        setNodeStreamingTexts((prev) => ({
          ...prev,
          [nodeId]: (prev[nodeId] ?? "") + chunk,
        }));
      },
      (history: ChatMessage[]) => {
        // Clear streaming text and store history optimistically so there's no blank flash
        // while waiting for the DB refetch to return the updated chatHistory
        setNodeStreamingTexts((prev) => {
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
        setNodePendingHistories((prev) => ({ ...prev, [nodeId]: history }));
      },
    );
  }, [map.id, map.nodes, pan, zoom, createNodeAsync, sendMessage]);

  // Called by AIChatNode's own input
  const handleNodeChat = useCallback(async (
    nodeId: number,
    message: string,
    onChunk: (t: string) => void,
    onDone: (history: ChatMessage[]) => void,
    imageObjectPath?: string | null,
  ) => {
    const otherNodeIds = map.nodes
      .filter((n) => n.id !== nodeId && n.nodeType === "note")
      .map((n) => n.id);

    await sendMessage(map.id, nodeId, message, otherNodeIds, onChunk, onDone, imageObjectPath);
  }, [map.id, map.nodes, sendMessage]);

  const isBarStreaming = streamingNodeId !== null && !map.nodes.find(n => n.id === streamingNodeId);

  const cursorEntries = Object.entries(remoteCursors);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-dot-grid touch-none select-none"
      onDoubleClick={handleCanvasDoubleClick}
      onPointerMove={handlePointerMove}
    >
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {/* Nodes layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {map.nodes.map((node: Node) => {
            const otherNodeIds = map.nodes
              .filter((n) => n.id !== node.id)
              .map((n) => n.id);

            return (
              <div key={node.id} className="pointer-events-auto absolute">
                {node.nodeType === "ai_chat" ? (
                  <AIChatNode
                    node={node}
                    zoom={zoom}
                    otherNodeIds={otherNodeIds}
                    onChat={handleNodeChat}
                    isStreaming={streamingNodeId === node.id}
                    externalStreamingText={nodeStreamingTexts[node.id]}
                    pendingHistory={nodePendingHistories[node.id]}
                    readOnly={readOnly}
                  />
                ) : (
                  <NodeCard node={node} zoom={zoom} otherNodeIds={otherNodeIds} readOnly={readOnly} />
                )}
              </div>
            );
          })}
        </div>

        {/* Remote cursor layer — world space, no pointer events */}
        {cursorEntries.length > 0 && (
          <div className="absolute inset-0 z-50 pointer-events-none">
            {cursorEntries.map(([clientId, cursor]) => (
              <RemoteCursorDot key={clientId} cursor={cursor} />
            ))}
          </div>
        )}
      </div>

      {/* AI Chat Bar — fixed at bottom, hidden in read-only mode */}
      {!readOnly && <AIChatBar onSend={handleBarSend} isStreaming={isBarStreaming} />}

      {/* Auto-arrange button */}
      {!readOnly && map.nodes.some(n => n.nodeType === "note" || n.nodeType === "ai_chat") && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            size="sm"
            variant="secondary"
            className="flex items-center gap-1.5 shadow-md border border-border/60 bg-card/90 backdrop-blur-sm hover:bg-accent"
            onClick={handleOrganize}
            disabled={isOrganizing}
            title="Arrange notes and AI chats in logical left-to-right order using AI"
          >
            {isOrganizing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <LayoutTemplate className="w-3.5 h-3.5" />}
            <span>{isOrganizing ? "Arranging…" : "Organisze"}</span>
          </Button>
        </div>
      )}

      {/* HUD */}
      <div className="absolute bottom-20 right-6 flex items-center gap-2 bg-card/80 backdrop-blur-md p-2 rounded-xl shadow-lg border border-border/50 pointer-events-none">
        <div className="px-3 text-sm font-medium text-muted-foreground border-r border-border">
          {Math.round(zoom * 100)}%
        </div>
        <div className="px-3 text-xs text-muted-foreground flex flex-col gap-0.5">
          <span>
            <kbd className="font-sans bg-muted px-1 rounded">Double-click</kbd> to add note
          </span>
          <span>
            <kbd className="font-sans bg-muted px-1 rounded">Ctrl + Scroll</kbd> to zoom
          </span>
          <span>
            <kbd className="font-sans bg-muted px-1 rounded">AI bar</kbd> below to chat with Claude
          </span>
        </div>
      </div>
    </div>
  );
}

function RemoteCursorDot({ cursor }: { cursor: RemoteCursor }) {
  return (
    <div
      className="absolute"
      style={{ left: cursor.x, top: cursor.y, transform: "translate(-2px, -2px)" }}
    >
      {/* Arrow cursor SVG */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
      >
        <path
          d="M3 2L17 9.5L10.5 11.5L8 18L3 2Z"
          fill={cursor.color}
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {/* Color pill below cursor */}
      <div
        className="absolute left-4 top-4 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap leading-tight"
        style={{ backgroundColor: cursor.color, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
      >
        Guest
      </div>
    </div>
  );
}
