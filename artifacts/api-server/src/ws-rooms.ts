import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { db, thoughtMapsTable, nodesTable, connectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const CURSOR_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f43f5e",
];

let colorIndex = 0;
function nextColor(): string {
  const color = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length];
  colorIndex++;
  return color;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface ClientInfo {
  ws: WebSocket;
  clientId: string;
  color: string;
  mapId: number;
}

const rooms = new Map<number, Set<ClientInfo>>();

function joinRoom(mapId: number, info: ClientInfo) {
  if (!rooms.has(mapId)) rooms.set(mapId, new Set());
  rooms.get(mapId)!.add(info);
}

function leaveRoom(info: ClientInfo) {
  const room = rooms.get(info.mapId);
  if (!room) return;
  room.delete(info);
  if (room.size === 0) {
    rooms.delete(info.mapId);
  } else {
    const leave = JSON.stringify({ type: "cursorLeave", clientId: info.clientId });
    room.forEach((peer) => {
      if (peer.ws.readyState === WebSocket.OPEN) peer.ws.send(leave);
    });
  }
}

export async function broadcastMapUpdate(mapId: number) {
  const room = rooms.get(mapId);
  if (!room || room.size === 0) return;

  const [map] = await db
    .select()
    .from(thoughtMapsTable)
    .where(eq(thoughtMapsTable.id, mapId));
  if (!map) return;

  const nodes = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.mapId, mapId))
    .orderBy(nodesTable.createdAt);

  const connections = await db
    .select()
    .from(connectionsTable)
    .where(eq(connectionsTable.mapId, mapId))
    .orderBy(connectionsTable.createdAt);

  const message = JSON.stringify({
    type: "mapUpdate",
    data: { ...map, nodes, connections },
  });

  room.forEach((info) => {
    if (info.ws.readyState === WebSocket.OPEN) {
      info.ws.send(message);
    }
  });
}

export function setupWebSocket(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/api/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url!, `http://localhost`);
    const mapId = parseInt(url.searchParams.get("mapId") ?? "0");

    if (!mapId || isNaN(mapId)) {
      ws.close(1008, "mapId is required");
      return;
    }

    const info: ClientInfo = {
      ws,
      clientId: randomId(),
      color: nextColor(),
      mapId,
    };

    joinRoom(mapId, info);

    ws.send(JSON.stringify({ type: "clientInit", clientId: info.clientId, color: info.color }));

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "cursorMove" && typeof msg.x === "number" && typeof msg.y === "number") {
          const cursor = JSON.stringify({
            type: "cursorUpdate",
            clientId: info.clientId,
            color: info.color,
            x: msg.x,
            y: msg.y,
          });
          const room = rooms.get(mapId);
          if (!room) return;
          room.forEach((peer) => {
            if (peer !== info && peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(cursor);
            }
          });
        }
      } catch {
      }
    });

    ws.on("close", () => leaveRoom(info));
    ws.on("error", () => leaveRoom(info));
  });
}
