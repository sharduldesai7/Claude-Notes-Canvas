import { useState, useRef } from "react";
import { useGesture } from "@use-gesture/react";
import { ThoughtMapFull } from "@workspace/api-client-react";
import { useCreateNode } from "@/hooks/use-nodes";
import { useDeleteConnection } from "@/hooks/use-connections";
import { NodeCard } from "./NodeCard";

interface CanvasProps {
  map: ThoughtMapFull;
}

export function Canvas({ map }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const { mutate: createNode } = useCreateNode();
  const { mutate: deleteConnection } = useDeleteConnection();

  useGesture(
    {
      onDrag: ({ delta: [dx, dy], pinching }) => {
        if (pinching) return;
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

  const getNodeCenter = (nodeId: number) => {
    const node = map.nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const w = node.width || 280;
    return { x: node.positionX + w / 2, y: node.positionY + 50 };
  };

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
        {/* SVG Connections Layer */}
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none z-0"
          width="100%"
          height="100%"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
            </marker>
          </defs>

          {map.connections.map((conn) => {
            const from = getNodeCenter(conn.fromNodeId);
            const to = getNodeCenter(conn.toNodeId);
            const dist = Math.abs(to.x - from.x) * 0.5;
            const path = `M ${from.x} ${from.y} C ${from.x + dist} ${from.y}, ${to.x - dist} ${to.y}, ${to.x} ${to.y}`;

            return (
              <g
                key={conn.id}
                className="group pointer-events-auto cursor-pointer"
                onClick={() => deleteConnection({ mapId: map.id, connectionId: conn.id })}
              >
                <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
                <path
                  d={path}
                  stroke="hsl(var(--primary)/0.5)"
                  strokeWidth="2"
                  strokeDasharray="6 5"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="group-hover:stroke-destructive transition-colors duration-200"
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {map.nodes.map((node) => (
            <div key={node.id} className="pointer-events-auto absolute">
              <NodeCard node={node} zoom={zoom} />
            </div>
          ))}
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
            <kbd className="font-sans bg-muted px-1 rounded">/claude</kbd> + Enter to ask AI
          </span>
        </div>
      </div>
    </div>
  );
}
