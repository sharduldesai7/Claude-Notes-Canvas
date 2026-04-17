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
  const unmountedRef = useRef(false);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});

  const connect = useCallback(() => {
    if (!mapId || unmountedRef.current) return;

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
      if (!unmountedRef.current) {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [mapId, shareToken, queryClient]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
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
