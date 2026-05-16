import { useState } from "react";
import { ChatMessage } from "@/components/AIChatNode";

export function useChatStream() {
  const [streamingNodeId, setStreamingNodeId] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");

  const sendMessage = async (
    mapId: number,
    nodeId: number,
    message: string,
    contextNodeIds: number[],
    onChunk: (text: string) => void,
    onDone: (history: ChatMessage[]) => void,
    imageObjectPath?: string | null,
  ) => {
    setStreamingNodeId(nodeId);
    setStreamingText("");

    try {
      const res = await fetch(`/api/thought-maps/${mapId}/nodes/${nodeId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, contextNodeIds, ...(imageObjectPath ? { imageObjectPath } : {}) }),
      });
      if (!res.ok || !res.body) {
      	if (!res.ok) {
    		try {
      			const errData = await res.json();
      			const errMsg = errData?.error?.error?.message || errData?.error || "Something went wrong.";
      			onChunk(errMsg);
      			onDone([...[], { role: "assistant" as const, text: errMsg }]);
    		} catch {
      			onChunk("Something went wrong. Please try again.");
      			onDone([{ role: "assistant" as const, text: "Something went wrong. Please try again." }]);
    		}
  		}
  		return;
	}

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalHistory: ChatMessage[] | null = null;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6).trim());
              if (data.done) {
                done = true;
                if (data.history) finalHistory = data.history as ChatMessage[];
              } else if (data.content) {
                setStreamingText((t) => t + data.content);
                onChunk(data.content);
              }
            } catch {}
          }
        }
      }

      if (finalHistory) onDone(finalHistory);
    } finally {
      setStreamingNodeId(null);
      setStreamingText("");
    }
  };

  return { sendMessage, streamingNodeId, streamingText };
}
