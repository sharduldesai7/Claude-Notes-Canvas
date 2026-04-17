import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetThoughtMapQueryKey } from "@workspace/api-client-react";

export interface RemoteCursor {
  x: number;
  y: number;
  color: string;
}

function buildWsUrl(mapId: number, shareToken?: string | null): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  let url = `${protocol}//${host}/api/ws?mapId=${mapId}`;
  if (shareToken) {
    url += `&shareToken=${encodeURIComponent(shareToken)}`;
  }
  return url;
}

export function useRealtimeSync(
  mapId: number | null,
  shareToken?: string | null
) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  // Each connect() call gets a generation number. Cleanup increments it,
  // which invalidates any in-flight onclose so it won't schedule a stale reconnect.
  const generationRef = useRef(0);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});

  const connect = useCallback(() => {
    if (!mapId) return;

    const generation = ++generationRef.current;
    const url = buildWsUrl(mapId, shareToken);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);

        if (msg.type === "mapUpdate" && msg.data) {
          queryClient.setQueryData(getGetThoughtMapQueryKey(mapId), msg.data);
        } else if (msg.type === "cursorUpdate") {
          setRemoteCursors((prev) => ({
            ...prev,
            [msg.clientId]: { x: msg.x, y: msg.y, color: msg.color },
          }));
        } else if (msg.type === "cursorLeave") {
          setRemoteCursors((prev) => {
            const next = { ...prev };
            delete next[msg.clientId];
            return next;
          });
        }
      } catch {
      }
    };

    ws.onclose = () => {
      setRemoteCursors({});
      // Only reconnect if this generation is still the active one.
      // If cleanup has already run (incrementing generationRef), this is stale — skip.
      if (generationRef.current === generation) {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [mapId, shareToken, queryClient]);

  useEffect(() => {
    connect();

    return () => {
      // Increment generation — any pending onclose for the current WS will see the
      // mismatch and won't schedule a reconnect.
      generationRef.current++;
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      setRemoteCursors({});
    };
  }, [connect]);

  const sendCursorMove = useCallback((x: number, y: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "cursorMove", x, y }));
    }
  }, []);

  return { remoteCursors, sendCursorMove };
}
