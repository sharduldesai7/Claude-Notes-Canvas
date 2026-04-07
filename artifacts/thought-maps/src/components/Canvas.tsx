import { useState, useRef } from "react";
import { useGesture } from "@use-gesture/react";
import { ThoughtMapFull } from "@workspace/api-client-react";
import { useCreateNode } from "@/hooks/use-nodes";

import { NodeCard } from "./NodeCard";

interface CanvasProps {
  map: ThoughtMapFull;
}

export function Canvas({ map }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasDragAllowed = useRef(false);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const { mutate: createNode } = useCreateNode();

  useGesture(
    {
      onDrag: ({ delta: [dx, dy], pinching }) => {
        if (pinching || !canvasDragAllowed.current) return;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      },
      onWheel: ({ delta: [dx, dy], ctrlKey, event }) => {
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
    const target = e.target as HTMLElement;
    if (target.closest('[data-node-card]')) return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    createNode({
      mapId: map.id,
      data: { content: "", positionX: Math.round(x - 140), positionY: Math.round(y - 50) },
    });
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-dot-grid touch-none select-none"
      onDoubleClick={handleCanvasDoubleClick}
      onPointerDown={(e) => {
        // Track whether this drag started from the canvas background (not a node)
        canvasDragAllowed.current = !(e.target as HTMLElement).closest('[data-node-card]');
      }}
    >
      <div
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {/* Nodes Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {map.nodes.map((node) => {
            const otherNodeIds = map.nodes
              .filter((n) => n.id !== node.id)
              .map((n) => n.id);
            return (
              <div key={node.id} className="pointer-events-auto absolute">
                <NodeCard node={node} zoom={zoom} otherNodeIds={otherNodeIds} />
              </div>
            );
          })}
        </div>
      </div>

      {/* HUD */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-card/80 backdrop-blur-md p-2 rounded-xl shadow-lg border border-border/50">
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
            <kbd className="font-sans bg-muted px-1 rounded">/claude</kbd> + Enter for AI
          </span>
        </div>
      </div>
    </div>
  );
}
