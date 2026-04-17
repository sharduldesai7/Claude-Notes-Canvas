import { useState, useRef, useCallback, useEffect } from "react";
import { useGesture } from "@use-gesture/react";
import { ThoughtMapFull, Node } from "@workspace/api-client-react";
import { useCreateNode } from "@/hooks/use-nodes";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ChatMessage } from "./AIChatNode";

import { NodeCard } from "./NodeCard";
import { AIChatNode } from "./AIChatNode";
import { AIChatBar } from "./AIChatBar";

interface CanvasProps {
  map: ThoughtMapFull;
  readOnly?: boolean;
}

export function Canvas({ map, readOnly = false }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
  ) => {
    const otherNodeIds = map.nodes
      .filter((n) => n.id !== nodeId && n.nodeType === "note")
      .map((n) => n.id);

    await sendMessage(map.id, nodeId, message, otherNodeIds, onChunk, onDone);
  }, [map.id, map.nodes, sendMessage]);

  const isBarStreaming = streamingNodeId !== null && !map.nodes.find(n => n.id === streamingNodeId);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-dot-grid touch-none select-none"
      onDoubleClick={handleCanvasDoubleClick}
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
      </div>

      {/* AI Chat Bar — fixed at bottom, hidden in read-only mode */}
      {!readOnly && <AIChatBar onSend={handleBarSend} isStreaming={isBarStreaming} />}

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
