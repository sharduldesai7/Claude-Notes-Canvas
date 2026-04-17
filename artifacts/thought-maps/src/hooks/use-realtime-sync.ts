import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetThoughtMapQueryKey } from "@workspace/api-client-react";

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
        }
      } catch {
      }
    };

    ws.onclose = () => {
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
}
