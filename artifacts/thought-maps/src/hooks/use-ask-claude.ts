import { useState } from "react";

export function useAskClaudeStream() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async (
    mapId: number,
    nodeId: number,
    prompt: string,
    onChunk: (text: string) => void,
    contextNodeIds?: number[],
  ) => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/thought-maps/${mapId}/nodes/${nodeId}/ask-claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, contextNodeIds }),
      });

      if (!res.ok) throw new Error('Network response was not ok');
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.done) {
                done = true;
              } else if (data.content) {
                onChunk(data.content);
              }
            } catch (e) {
              console.error("[SSE] Failed to parse chunk:", e);
            }
          }
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return { generate, isGenerating };
}
