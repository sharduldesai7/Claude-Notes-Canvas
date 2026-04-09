import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, thoughtMapsTable, nodesTable, connectionsTable, userSettingsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// All routes require authentication
router.use(requireAuth);

// List all thought maps for current user
router.get("/", async (req: any, res) => {
  try {
    const maps = await db
      .select()
      .from(thoughtMapsTable)
      .where(eq(thoughtMapsTable.userId, req.userId))
      .orderBy(thoughtMapsTable.createdAt);
    res.json(maps);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list thought maps" });
  }
});

// Create a thought map
router.post("/", async (req: any, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const [map] = await db
      .insert(thoughtMapsTable)
      .values({ title, userId: req.userId })
      .returning();
    res.status(201).json(map);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create thought map" });
  }
});

// Get a thought map with nodes and connections (only own maps)
router.get("/:id", async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [map] = await db
      .select()
      .from(thoughtMapsTable)
      .where(and(eq(thoughtMapsTable.id, id), eq(thoughtMapsTable.userId, req.userId)));
    if (!map) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const nodes = await db.select().from(nodesTable).where(eq(nodesTable.mapId, id)).orderBy(nodesTable.createdAt);
    const connections = await db.select().from(connectionsTable).where(eq(connectionsTable.mapId, id)).orderBy(connectionsTable.createdAt);
    res.json({ ...map, nodes, connections });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get thought map" });
  }
});

// Update a thought map
router.patch("/:id", async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title } = req.body;
    const [map] = await db
      .update(thoughtMapsTable)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(thoughtMapsTable.id, id), eq(thoughtMapsTable.userId, req.userId)))
      .returning();
    if (!map) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(map);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update thought map" });
  }
});

// Delete a thought map
router.delete("/:id", async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [map] = await db
      .delete(thoughtMapsTable)
      .where(and(eq(thoughtMapsTable.id, id), eq(thoughtMapsTable.userId, req.userId)))
      .returning();
    if (!map) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete thought map" });
  }
});

// Helper: verify map belongs to user
async function verifyMapOwnership(mapId: number, userId: string): Promise<boolean> {
  const [map] = await db
    .select()
    .from(thoughtMapsTable)
    .where(and(eq(thoughtMapsTable.id, mapId), eq(thoughtMapsTable.userId, userId)));
  return !!map;
}

// List nodes in a thought map
router.get("/:mapId/nodes", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const nodes = await db.select().from(nodesTable).where(eq(nodesTable.mapId, mapId)).orderBy(nodesTable.createdAt);
    res.json(nodes);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list nodes" });
  }
});

// Create a node — auto-connects to all existing nodes, auto-assigns title
router.post("/:mapId/nodes", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const { content = "", positionX = 100, positionY = 100, width = 280, height = 160, color, nodeType = "note", chatHistory, title: titleOverride } = req.body;

    // Get all existing nodes before creating the new one
    const existingNodes = await db.select().from(nodesTable).where(eq(nodesTable.mapId, mapId));

    // Auto-generate title
    let title: string;
    if (titleOverride) {
      title = titleOverride;
    } else if (nodeType === "ai_chat") {
      title = "AI Chat";
    } else {
      const noteCount = existingNodes.filter(n => n.nodeType === "note").length;
      title = `Untitled ${noteCount + 1}`;
    }

    // Create the new node
    const [node] = await db
      .insert(nodesTable)
      .values({ mapId, title, nodeType, content, chatHistory: chatHistory || null, positionX, positionY, width, height, color: color || null })
      .returning();

    // Auto-connect new node to all existing nodes
    if (existingNodes.length > 0) {
      const connectionValues = existingNodes.map((existing) => ({
        mapId,
        fromNodeId: existing.id,
        toNodeId: node.id,
      }));
      await db.insert(connectionsTable).values(connectionValues);
    }

    res.status(201).json(node);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create node" });
  }
});

// Update a node
router.patch("/:mapId/nodes/:nodeId", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const nodeId = parseInt(req.params.nodeId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const updates = req.body;
    const [node] = await db
      .update(nodesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(nodesTable.id, nodeId), eq(nodesTable.mapId, mapId)))
      .returning();
    if (!node) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(node);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update node" });
  }
});

// Delete a node
router.delete("/:mapId/nodes/:nodeId", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const nodeId = parseInt(req.params.nodeId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [node] = await db
      .delete(nodesTable)
      .where(and(eq(nodesTable.id, nodeId), eq(nodesTable.mapId, mapId)))
      .returning();
    if (!node) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete node" });
  }
});

// List connections in a thought map
router.get("/:mapId/connections", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const connections = await db.select().from(connectionsTable).where(eq(connectionsTable.mapId, mapId));
    res.json(connections);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list connections" });
  }
});

// Create a connection
router.post("/:mapId/connections", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { fromNodeId, toNodeId } = req.body;
    if (!fromNodeId || !toNodeId) {
      res.status(400).json({ error: "fromNodeId and toNodeId are required" });
      return;
    }
    const [connection] = await db
      .insert(connectionsTable)
      .values({ mapId, fromNodeId, toNodeId })
      .returning();
    res.status(201).json(connection);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create connection" });
  }
});

// Delete a connection
router.delete("/:mapId/connections/:connectionId", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const connectionId = parseInt(req.params.connectionId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const [conn] = await db
      .delete(connectionsTable)
      .where(and(eq(connectionsTable.id, connectionId), eq(connectionsTable.mapId, mapId)))
      .returning();
    if (!conn) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete connection" });
  }
});

// Chat with an AI chat node — SSE streaming, maintains conversation history
router.post("/:mapId/nodes/:nodeId/chat", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const nodeId = parseInt(req.params.nodeId);
    const { message, contextNodeIds } = req.body;

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Fetch current node & user settings
    const [nodeRow] = await db.select().from(nodesTable).where(and(eq(nodesTable.id, nodeId), eq(nodesTable.mapId, mapId)));
    if (!nodeRow) { res.status(404).json({ error: "Node not found" }); return; }

    let [userSettings] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, req.userId));
    const preferredModel = userSettings?.preferredModel || "claude-sonnet-4-6";
    const customApiKey = userSettings?.customApiKey;
    const customBaseUrl = userSettings?.customBaseUrl;

    // Parse existing history
    let history: { role: "user" | "assistant"; text: string }[] = [];
    try { if (nodeRow.chatHistory) history = JSON.parse(nodeRow.chatHistory); } catch {}

    // Build context from other notes
    let contextSections: string[] = [];
    if (contextNodeIds && contextNodeIds.length > 0) {
      const allNodes = await db.select().from(nodesTable).where(eq(nodesTable.mapId, mapId));
      const referenced = allNodes.filter((n) => contextNodeIds.includes(n.id) && n.nodeType === "note");
      contextSections = referenced
        .filter(n => n.content)
        .map(n => `Note "${n.title || "Untitled"}": ${n.content}`);
    }

    const systemPrompt = [
      "You are a helpful AI assistant inside a mind-mapping app called Synaptica. Respond conversationally and concisely.",
      contextSections.length > 0
        ? `\n\nContext from notes on the canvas:\n${contextSections.join("\n\n")}`
        : ""
    ].join("");

    // Build Anthropic messages array from history + new message
    const anthropicMessages = [
      ...history.map(m => ({ role: m.role, content: m.text })),
      { role: "user" as const, content: message },
    ];

    // Append user message to history
    const updatedHistory = [...history, { role: "user" as const, text: message }];

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let client = anthropic;
    if (customApiKey?.trim()) {
      const opts: { apiKey: string; baseURL?: string } = { apiKey: customApiKey };
      if (customBaseUrl) opts.baseURL = customBaseUrl;
      client = new Anthropic(opts) as any;
    }

    let fullResponse = "";
    const stream = (client as any).messages.stream({
      model: preferredModel,
      max_tokens: 8192,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    // Persist complete history (user msg + assistant response)
    const finalHistory = [...updatedHistory, { role: "assistant" as const, text: fullResponse }];
    await db
      .update(nodesTable)
      .set({ chatHistory: JSON.stringify(finalHistory), updatedAt: new Date() })
      .where(and(eq(nodesTable.id, nodeId), eq(nodesTable.mapId, mapId)));

    res.write(`data: ${JSON.stringify({ done: true, history: finalHistory })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to get chat response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

// Ask Claude — SSE streaming with user's preferred model
router.post("/:mapId/nodes/:nodeId/ask-claude", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const nodeId = parseInt(req.params.nodeId);
    const { prompt, contextNodeIds } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Load user settings for preferred model / custom API key
    let [userSettings] = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, req.userId));
    
    const preferredModel = userSettings?.preferredModel || "claude-sonnet-4-6";
    const customApiKey = userSettings?.customApiKey;
    const customBaseUrl = userSettings?.customBaseUrl;

    // Build context from referenced nodes
    let contextMessages: string[] = [];
    if (contextNodeIds && contextNodeIds.length > 0) {
      const contextNodes = await db.select().from(nodesTable).where(eq(nodesTable.mapId, mapId));
      const referenced = contextNodes.filter((n) => contextNodeIds.includes(n.id));
      if (referenced.length > 0) {
        contextMessages = referenced.map((n) => {
          let ctx = `Note content: ${n.content}`;
          if (n.claudeResponse) ctx += `\nClaude's previous response: ${n.claudeResponse}`;
          return ctx;
        });
      }
    }

    // Mark node as processing
    await db
      .update(nodesTable)
      .set({ isProcessing: true, claudeResponse: null, updatedAt: new Date() })
      .where(and(eq(nodesTable.id, nodeId), eq(nodesTable.mapId, mapId)));

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const systemPrompt = contextMessages.length > 0
      ? `You are a helpful assistant in a mind-mapping app called Synaptica. Context from related notes:\n\n${contextMessages.join("\n\n---\n\n")}`
      : "You are a helpful assistant in a mind-mapping app called Synaptica. Help the user think through their ideas clearly and concisely.";

    let fullResponse = "";

    // Use custom API key if user has provided one, otherwise use default
    let client = anthropic;
    if (customApiKey && customApiKey.trim()) {
      const opts: { apiKey: string; baseURL?: string } = { apiKey: customApiKey };
      if (customBaseUrl) opts.baseURL = customBaseUrl;
      client = new Anthropic(opts) as any;
    }

    // Determine model — validate it's a supported model if using defaults
    const model = preferredModel || "claude-sonnet-4-6";

    const stream = (client as any).messages.stream({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    // Save the full response
    await db
      .update(nodesTable)
      .set({ claudeResponse: fullResponse, isProcessing: false, updatedAt: new Date() })
      .where(and(eq(nodesTable.id, nodeId), eq(nodesTable.mapId, mapId)));

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to get Claude response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
