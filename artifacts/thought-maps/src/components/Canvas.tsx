import { useState, useRef } from "react";
import { useGesture } from "@use-gesture/react";
import { ThoughtMapFull, Node } from "@workspace/api-client-react";
import { useCreateNode } from "@/hooks/use-nodes";
import { useCreateConnection, useDeleteConnection } from "@/hooks/use-connections";
import { NodeCard } from "./NodeCard";
import { Trash2 } from "lucide-react";

interface CanvasProps {
  map: ThoughtMapFull;
}

export function Canvas({ map }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  
  const { mutate: createNode } = useCreateNode();
  const { mutate: createConnection } = useCreateConnection();
  const { mutate: deleteConnection } = useDeleteConnection();

  const [draftConn, setDraftConnection] = useState<{fromNodeId: number, x1: number, y1: number, x2: number, y2: number} | null>(null);

  // Canvas Gestures
  useGesture({
    onDrag: ({ delta: [dx, dy], pinching, event }) => {
      if (pinching) return;
      // Only pan if dragging directly on the canvas background
      if ((event.target as HTMLElement).id === "canvas-bg") {
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      }
    },
    onWheel: ({ delta: [dx, dy], ctrlKey, event }) => {
      event.preventDefault();
      if (ctrlKey) {
        setZoom(z => Math.max(0.2, Math.min(3, z - dy * 0.01)));
      } else {
        setPan(p => ({ x: p.x - dx, y: p.y - dy }));
      }
    },
    onPointerMove: ({ event }) => {
      if (draftConn && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Calculate mouse pos relative to the transformed canvas
        const mouseX = (event.clientX - rect.left - pan.x) / zoom;
        const mouseY = (event.clientY - rect.top - pan.y) / zoom;
        setDraftConnection(d => d ? { ...d, x2: mouseX, y2: mouseY } : null);
      }
    },
    onPointerUp: () => {
      if (draftConn) setDraftConnection(null);
    }
  }, { 
    target: containerRef, 
    eventOptions: { passive: false } 
  });

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    // Don't create a node if the user double-clicked on an existing node card
    const target = e.target as HTMLElement;
    if (target.closest('[data-node-card]')) return;
    
    const rect = containerRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    createNode({
      mapId: map.id,
      data: { content: "", positionX: x - 140, positionY: y - 50 } // Center the node roughly
    });
  };

  const handleConnectionStart = (nodeId: number, x: number, y: number) => {
    setDraftConnection({ fromNodeId: nodeId, x1: x, y1: y, x2: x, y2: y });
  };

  const handleConnectionEnd = (toNodeId: number) => {
    if (draftConn && draftConn.fromNodeId !== toNodeId) {
      createConnection({
        mapId: map.id,
        data: { fromNodeId: draftConn.fromNodeId, toNodeId }
      });
    }
    setDraftConnection(null);
  };

  const getNodeCenter = (nodeId: number) => {
    const node = map.nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    return { x: node.positionX + 140, y: node.positionY + 50 };
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative overflow-hidden bg-dot-grid touch-none select-none"
      onDoubleClick={handleCanvasDoubleClick}
      id="canvas-bg"
    >
      <div 
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        {/* SVG Connections Layer */}
        <svg className="absolute inset-0 overflow-visible pointer-events-none z-0">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
            </marker>
          </defs>
          
          {map.connections.map(conn => {
            const from = getNodeCenter(conn.fromNodeId);
            const to = getNodeCenter(conn.toNodeId);
            // Simple cubic bezier curve for the connections
            const dist = Math.abs(to.x - from.x) * 0.5;
            const path = `M ${from.x} ${from.y} C ${from.x + dist} ${from.y}, ${to.x - dist} ${to.y}, ${to.x} ${to.y}`;
            
            return (
              <g key={conn.id} className="group pointer-events-auto cursor-pointer" onClick={() => deleteConnection({ mapId: map.id, connectionId: conn.id })}>
                {/* Invisible thicker path for easier hovering/clicking */}
                <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
                <path 
                  d={path} 
                  stroke="hsl(var(--primary)/0.6)" 
                  strokeWidth="3" 
                  strokeDasharray="6 6" 
                  fill="none" 
                  markerEnd="url(#arrowhead)"
                  className="group-hover:stroke-destructive transition-colors duration-200"
                />
              </g>
            );
          })}

          {draftConn && (
            <path 
              d={`M ${draftConn.x1} ${draftConn.y1} C ${draftConn.x1 + Math.abs(draftConn.x2 - draftConn.x1)*0.5} ${draftConn.y1}, ${draftConn.x2 - Math.abs(draftConn.x2 - draftConn.x1)*0.5} ${draftConn.y2}, ${draftConn.x2} ${draftConn.y2}`}
              stroke="hsl(var(--primary)/0.5)" 
              strokeWidth="3" 
              strokeDasharray="6 6" 
              fill="none" 
            />
          )}
        </svg>

        {/* Nodes Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {map.nodes.map(node => (
            <div key={node.id} className="pointer-events-auto absolute">
              <NodeCard 
                node={node} 
                zoom={zoom}
                onConnectionStart={handleConnectionStart}
                onConnectionEnd={handleConnectionEnd}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar / Helper UI overlay */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-card/80 backdrop-blur-md p-2 rounded-xl shadow-lg border border-border/50">
        <div className="px-3 text-sm font-medium text-muted-foreground border-r border-border">
          {Math.round(zoom * 100)}%
        </div>
        <div className="px-3 text-xs text-muted-foreground flex flex-col">
          <span><kbd className="font-sans bg-muted px-1 rounded">Double click</kbd> to add note</span>
          <span><kbd className="font-sans bg-muted px-1 rounded">Ctrl + Scroll</kbd> to zoom</span>
        </div>
      </div>
    </div>
  );
}
