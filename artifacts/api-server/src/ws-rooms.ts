import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { db, thoughtMapsTable, nodesTable, connectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const rooms = new Map<number, Set<WebSocket>>();

function joinRoom(mapId: number, ws: WebSocket) {
  if (!rooms.has(mapId)) rooms.set(mapId, new Set());
  rooms.get(mapId)!.add(ws);
}

function leaveRoom(mapId: number, ws: WebSocket) {
  const room = rooms.get(mapId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) rooms.delete(mapId);
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

  room.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
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

    joinRoom(mapId, ws);

    ws.on("close", () => leaveRoom(mapId, ws));
    ws.on("error", () => leaveRoom(mapId, ws));
  });
}
