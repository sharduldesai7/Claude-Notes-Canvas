import { Router, type IRouter } from "express";
import { eq, and, or, count } from "drizzle-orm";
import { db, thoughtMapsTable, nodesTable, connectionsTable, userSettingsTable, mapSharesTable } from "@workspace/db";
import { GoogleGenAI } from "@google/genai";
//const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
import { requireAuthOrGuest } from "../middlewares/auth";
import { broadcastMapUpdate } from "../ws-rooms";
import { ObjectStorageService } from "../lib/objectStorage";

const objectStorageService = new ObjectStorageService();

async function fetchImageAsBase64(objectPath: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const [[buffer], [metadata]] = await Promise.all([
      file.download() as Promise<[Buffer, unknown]>,
      file.getMetadata() as Promise<[Record<string, unknown>, unknown]>,
    ]);
    return {
      data: buffer.toString("base64"),
      mediaType: (metadata.contentType as string) || "image/jpeg",
    };
  } catch {
    return null;
  }
}

const router: IRouter = Router();

// All routes require authentication (Clerk) or a valid guest session token
router.use(requireAuthOrGuest);

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
const GUEST_MAP_LIMIT = 2;

router.post("/", async (req: any, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }

    // Guest users may only create up to GUEST_MAP_LIMIT maps
    if (req.isGuest) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(thoughtMapsTable)
        .where(eq(thoughtMapsTable.userId, req.userId));
      if (value >= GUEST_MAP_LIMIT) {
        res.status(403).json({ error: `Guest sessions are limited to ${GUEST_MAP_LIMIT} maps.` });
        return;
      }
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

// Get a thought map with nodes and connections (own maps or valid share token)
router.get("/:id", async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const shareToken = req.headers["x-share-token"] as string | undefined;

    let map: typeof thoughtMapsTable.$inferSelect | undefined;

    const [ownedMap] = await db
      .select()
      .from(thoughtMapsTable)
      .where(and(eq(thoughtMapsTable.id, id), eq(thoughtMapsTable.userId, req.userId)));

    if (ownedMap) {
      map = ownedMap;
    } else if (shareToken) {
      const [share] = await db
        .select()
        .from(mapSharesTable)
        .where(and(eq(mapSharesTable.token, shareToken), eq(mapSharesTable.mapId, id)));
      if (share) {
        const [sharedMap] = await db.select().from(thoughtMapsTable).where(eq(thoughtMapsTable.id, id));
        map = sharedMap;
      }
    }

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

// Helper: verify map belongs to user OR is accessible via a share token
// minPermission: 'read' means any valid share is OK; 'edit' requires edit-permission share
async function verifyMapOwnership(
  mapId: number,
  userId: string,
  shareToken?: string,
  minPermission: "read" | "edit" = "edit"
): Promise<boolean> {
  const [map] = await db
    .select()
    .from(thoughtMapsTable)
    .where(and(eq(thoughtMapsTable.id, mapId), eq(thoughtMapsTable.userId, userId)));
  if (map) return true;

  if (shareToken) {
    const [share] = await db
      .select()
      .from(mapSharesTable)
      .where(and(eq(mapSharesTable.token, shareToken), eq(mapSharesTable.mapId, mapId)));
    if (share) {
      if (minPermission === "read") return true;
      return share.permission === "edit";
    }
  }
  return false;
}

// List nodes in a thought map
router.get("/:mapId/nodes", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const shareToken = req.headers["x-share-token"] as string | undefined;
    if (!await verifyMapOwnership(mapId, req.userId, shareToken, "read")) {
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
    const shareToken = req.headers["x-share-token"] as string | undefined;
    if (!await verifyMapOwnership(mapId, req.userId, shareToken, "edit")) {
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
    broadcastMapUpdate(mapId).catch(() => {});
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
    const shareToken = req.headers["x-share-token"] as string | undefined;
    if (!await verifyMapOwnership(mapId, req.userId, shareToken, "edit")) {
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
    broadcastMapUpdate(mapId).catch(() => {});
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
    const shareToken = req.headers["x-share-token"] as string | undefined;
    if (!await verifyMapOwnership(mapId, req.userId, shareToken, "edit")) {
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
    broadcastMapUpdate(mapId).catch(() => {});
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete node" });
  }
});

// List connections in a thought map
router.get("/:mapId/connections", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const shareToken = req.headers["x-share-token"] as string | undefined;
    if (!await verifyMapOwnership(mapId, req.userId, shareToken, "read")) {
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
    const shareToken = req.headers["x-share-token"] as string | undefined;
    if (!await verifyMapOwnership(mapId, req.userId, shareToken, "edit")) {
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
    broadcastMapUpdate(mapId).catch(() => {});
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
    const shareToken = req.headers["x-share-token"] as string | undefined;
    if (!await verifyMapOwnership(mapId, req.userId, shareToken, "edit")) {
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
    broadcastMapUpdate(mapId).catch(() => {});
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
    const { message, imageObjectPath } = req.body;

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const shareToken = req.headers["x-share-token"] as string | undefined;
    if (!await verifyMapOwnership(mapId, req.userId, shareToken, "edit")) {
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
    const genai = new GoogleGenAI({ apiKey: customApiKey?.trim() || process.env.GEMINI_API_KEY! });

    // Parse existing history
    let history: { role: "user" | "assistant"; text: string; imageUrl?: string }[] = [];
    try { if (nodeRow.chatHistory) history = JSON.parse(nodeRow.chatHistory); } catch {}

    // Build context from ALL notes on the canvas (always fresh from DB — never stale)
    const allNotes = await db.select().from(nodesTable).where(
      and(eq(nodesTable.mapId, mapId), eq(nodesTable.nodeType, "note"))
    );
    const contextNotes = allNotes.filter(n => n.id !== nodeId && (n.content || n.imageUrl));
    const contextSections = contextNotes.map(n => {
      let section = `Note "${n.title || "Untitled"}": ${n.content || "(no text)"}`;
      if (n.imageUrl) section += " [has attached image]";
      return section;
    });

    const systemPrompt = [
      "You are a helpful AI assistant inside a mind-mapping app called Synaptica. Respond conversationally and concisely.",
      contextSections.length > 0
        ? `\n\nContext from notes on the canvas:\n${contextSections.join("\n\n")}`
        : ""
    ].join("");

    // Fetch images from notes that have them (for vision context)
    const noteImageResults = await Promise.all(
      contextNotes
        .filter(n => n.imageUrl)
        .map(async n => {
          const imgData = await fetchImageAsBase64(n.imageUrl!);
          return imgData ? { note: n, imgData } : null;
        })
    );
    const noteImages = noteImageResults.filter((x): x is { note: typeof contextNotes[0]; imgData: { data: string; mediaType: string } } => x !== null);

    // Optionally fetch image for the user's current message
    let imageData: { data: string; mediaType: string } | null = null;
    if (imageObjectPath) {
      imageData = await fetchImageAsBase64(imageObjectPath);
    }

    // Build user message content (with optional vision block for user-attached image)
    const userMessageContent: Anthropic.MessageParam["content"] = imageData
      ? [
          { type: "image", source: { type: "base64", media_type: imageData.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageData.data } },
          { type: "text", text: message },
        ]
      : message;

    // Build Anthropic messages array:
    // 1. If there are note images, prepend a context exchange so Claude can see them
    // 2. Then the real conversation history
    // 3. Then the current user message
    const anthropicMessages: Anthropic.MessageParam[] = [];

    if (noteImages.length > 0) {
      const noteImageContent: Anthropic.MessageParam["content"] = noteImages.flatMap(ni => [
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: ni.imgData.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: ni.imgData.data,
          },
        },
        { type: "text" as const, text: `[Image attached to note "${ni.note.title || "Untitled"}"]` },
      ]);
      anthropicMessages.push({ role: "user" as const, content: noteImageContent });
      anthropicMessages.push({ role: "assistant" as const, content: "I can see the images attached to the notes on your canvas and will reference them as needed." });
    }

    anthropicMessages.push(...history.map(m => ({ role: m.role, content: m.text } as Anthropic.MessageParam)));
    anthropicMessages.push({ role: "user" as const, content: userMessageContent });

    // Append user message to history (store imageUrl for display)
    const historyEntry: { role: "user"; text: string; imageUrl?: string } = { role: "user" as const, text: message };
    if (imageObjectPath) historyEntry.imageUrl = imageObjectPath;
    const updatedHistory = [...history, historyEntry];

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let fullResponse = "";
	const geminiMessages = anthropicMessages.map((m: any) => ({
  		role: m.role === "assistant" ? "model" : "user",
  		parts: [{ text: typeof m.content === "string" ? m.content : m.content.find((c: any) => c.type === "text")?.text || "" }],
	}));

	const geminiStream = await genai.models.generateContentStream({
  		model: "gemini-2.5-flash",
  		contents: geminiMessages,
  		config: { systemInstruction: systemPrompt },
	});

	for await (const chunk of geminiStream) {
  		const text = chunk.text ?? "";
  		if (text) {
    		fullResponse += text;
    		res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
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
    broadcastMapUpdate(mapId).catch(() => {});
  } catch (err) {
    req.log.error(err);
    const anthropicMessage = (err as any)?.error?.error?.message;
    if (!res.headersSent) {
      res.status(500).json({ error: anthropicMessage || "Failed to get chat response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: anthropicMessage || "Stream error" })}\n\n`);
      res.end();
    }
  }
});

// Ask Claude — SSE streaming with user's preferred model
router.post("/:mapId/nodes/:nodeId/ask-claude", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const nodeId = parseInt(req.params.nodeId);
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const shareToken = req.headers["x-share-token"] as string | undefined;
    if (!await verifyMapOwnership(mapId, req.userId, shareToken, "edit")) {
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
    const genai = new GoogleGenAI({ apiKey: customApiKey?.trim() || process.env.GEMINI_API_KEY! });

    // Load node to check for attached image (also verifies it exists)
    const [askNodeRow] = await db.select().from(nodesTable).where(and(eq(nodesTable.id, nodeId), eq(nodesTable.mapId, mapId)));
    if (!askNodeRow) { res.status(404).json({ error: "Node not found" }); return; }

    // Build context from ALL notes on the canvas (always fresh from DB — never stale)
    const allCanvasNotes = await db.select().from(nodesTable).where(
      and(eq(nodesTable.mapId, mapId), eq(nodesTable.nodeType, "note"))
    );
    const contextMessages = allCanvasNotes
      .filter(n => n.id !== nodeId)
      .map(n => {
        let ctx = `Note "${n.title || "Untitled"}": ${n.content || "(empty)"}`;
        if (n.claudeResponse) ctx += `\nClaude's previous thoughts: ${n.claudeResponse}`;
        return ctx;
      });

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
      ? `You are a helpful assistant in a mind-mapping app called Synaptica. Context from other notes on the canvas:\n\n${contextMessages.join("\n\n---\n\n")}`
      : "You are a helpful assistant in a mind-mapping app called Synaptica. Help the user think through their ideas clearly and concisely.";

    // Optionally attach node image as vision block
    let askImageData: { data: string; mediaType: string } | null = null;
    if (askNodeRow.imageUrl) {
      askImageData = await fetchImageAsBase64(askNodeRow.imageUrl);
    }

    const askUserContent: Anthropic.MessageParam["content"] = askImageData
      ? [
          { type: "image", source: { type: "base64", media_type: askImageData.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: askImageData.data } },
          { type: "text", text: prompt },
        ]
      : prompt;

    let fullResponse = "";
	const askGeminiStream = await genai.models.generateContentStream({
  		model: "gemini-2.5-flash",
  		contents: [{ role: "user", parts: [{ text: typeof askUserContent === "string" ? askUserContent : (askUserContent as any[]).find((c: any) => c.type === "text")?.text || "" }] }],
  		config: { systemInstruction: systemPrompt },
	});

	for await (const chunk of askGeminiStream) {
  		const text = chunk.text ?? "";
  		if (text) {
    		fullResponse += text;
    		res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
  		}
	}

    // Save the full response
    await db
      .update(nodesTable)
      .set({ claudeResponse: fullResponse, isProcessing: false, updatedAt: new Date() })
      .where(and(eq(nodesTable.id, nodeId), eq(nodesTable.mapId, mapId)));

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    broadcastMapUpdate(mapId).catch(() => {});
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

// ── Share management routes ──────────────────────────────────────────────────

// List share links for a map (owner only)
router.get("/:mapId/shares", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const shares = await db.select().from(mapSharesTable).where(eq(mapSharesTable.mapId, mapId));
    res.json(shares);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list shares" });
  }
});

// Create a share link (owner only)
router.post("/:mapId/shares", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { permission } = req.body;
    if (!permission || !["read", "edit"].includes(permission)) {
      res.status(400).json({ error: "permission must be 'read' or 'edit'" });
      return;
    }
    const token = generateShareToken();
    const [share] = await db
      .insert(mapSharesTable)
      .values({ mapId, token, permission, createdBy: req.userId })
      .returning();
    res.status(201).json(share);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create share" });
  }
});

// Revoke a share link (owner only)
router.delete("/:mapId/shares/:shareId", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const shareId = parseInt(req.params.shareId);
    if (!await verifyMapOwnership(mapId, req.userId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(mapSharesTable).where(and(eq(mapSharesTable.id, shareId), eq(mapSharesTable.mapId, mapId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to revoke share" });
  }
});

// Auto-arrange notes logically left-to-right using Claude
router.post("/:mapId/organize", async (req: any, res) => {
  try {
    const mapId = parseInt(req.params.mapId);

    if (!await verifyMapOwnership(mapId, req.userId, undefined, "edit")) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const notes = await db.select().from(nodesTable).where(
      and(
        eq(nodesTable.mapId, mapId),
        or(eq(nodesTable.nodeType, "note"), eq(nodesTable.nodeType, "ai_chat"))
      )
    );

    if (notes.length < 2) {
      res.json({ success: true, order: notes.map(n => n.id) });
      return;
    }

    // Ask Claude to determine the logical reading order
    const noteSummaries = notes.map(n => {
      const type = n.nodeType === "ai_chat" ? "AI Chat" : "Note";
      return `ID ${n.id} | Type: ${type} | Title: "${n.title || "Untitled"}" | Content: "${(n.content || "").slice(0, 300)}"`;
    }).join("\n");

    const response = await genai.models.generateContent({
  		model: "gemini-2.5-flash",
  		contents: [{
    		role: "user",
    		parts: [{ text: `You are organizing notes on a visual thinking canvas. Arrange these notes in the most logical left-to-right reading order — consider narrative flow, cause-and-effect, chronology, or general-to-specific, whichever best fits the content.

Return ONLY a JSON array of note IDs in the order they should appear left-to-right. Nothing else. Example: [12, 7, 3, 15]

Notes:
${noteSummaries}` }],
  		}],
	});

	const rawText = response.text?.trim() ?? "";

    const jsonMatch = rawText.match(/\[[\d,\s]+\]/);
    let orderedIds: number[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Validate + append any notes Claude missed; deduplicate to avoid double-placement
    const validIds = new Set(notes.map(n => n.id));
    const seen = new Set<number>();
    orderedIds = orderedIds.filter(id => {
      if (!validIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const missed = notes.filter(n => !seen.has(n.id)).map(n => n.id);
    const finalOrder = [...orderedIds, ...missed];

    // Grid layout — up to 5 columns, wraps into rows when there are many nodes.
    // Uses per-node stored sizes so no two cells ever overlap.
    const DEFAULT_NOTE_W = 280;
    const DEFAULT_NOTE_H = 220;  // conservative height for auto-sized notes
    const DEFAULT_CHAT_W = 320;
    const DEFAULT_CHAT_H = 400;
    const COL_GAP = 40;
    const ROW_GAP = 40;
    const START_X = 40;
    const START_Y = 40;

    const COL_COUNT = Math.min(finalOrder.length, 5);
    const ROW_COUNT = Math.ceil(finalOrder.length / COL_COUNT);

    // Measure each node
    const nodeSize = (id: number) => {
      const n = notes.find(n => n.id === id)!;
      return {
        w: n.width  || (n.nodeType === "ai_chat" ? DEFAULT_CHAT_W : DEFAULT_NOTE_W),
        h: n.height || (n.nodeType === "ai_chat" ? DEFAULT_CHAT_H : DEFAULT_NOTE_H),
      };
    };

    // Pass 1 — find the max width per column and max height per row
    const colMaxW = Array<number>(COL_COUNT).fill(0);
    const rowMaxH = Array<number>(ROW_COUNT).fill(0);
    finalOrder.forEach((id, idx) => {
      const col = idx % COL_COUNT;
      const row = Math.floor(idx / COL_COUNT);
      const { w, h } = nodeSize(id);
      if (w > colMaxW[col]) colMaxW[col] = w;
      if (h > rowMaxH[row]) rowMaxH[row] = h;
    });

    // Pass 2 — compute cumulative X / Y offsets
    const colX: number[] = [START_X];
    for (let c = 1; c < COL_COUNT; c++) {
      colX[c] = colX[c - 1] + colMaxW[c - 1] + COL_GAP;
    }
    const rowY: number[] = [START_Y];
    for (let r = 1; r < ROW_COUNT; r++) {
      rowY[r] = rowY[r - 1] + rowMaxH[r - 1] + ROW_GAP;
    }

    // Apply positions sequentially (for loop guarantees no shared state issues)
    const updates: Promise<unknown>[] = [];
    for (let idx = 0; idx < finalOrder.length; idx++) {
      const id = finalOrder[idx];
      const col = idx % COL_COUNT;
      const row = Math.floor(idx / COL_COUNT);
      updates.push(
        db.update(nodesTable)
          .set({ positionX: colX[col], positionY: rowY[row], updatedAt: new Date() })
          .where(eq(nodesTable.id, id))
      );
    }
    await Promise.all(updates);

    broadcastMapUpdate(mapId);
    res.json({ success: true, order: finalOrder });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to organize notes" });
  }
});

function generateShareToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export default router;
