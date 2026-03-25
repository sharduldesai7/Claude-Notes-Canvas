import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, thoughtMapsTable, nodesTable, connectionsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

// List all thought maps
router.get("/", async (req, res) => {
  try {
    const maps = await db.select().from(thoughtMapsTable).orderBy(thoughtMapsTable.createdAt);
    res.json(maps);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list thought maps" });
  }
});

// Create a thought map
router.post("/", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const [map] = await db.insert(thoughtMapsTable).values({ title }).returning();
    res.status(201).json(map);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create thought map" });
  }
});

// Get a thought map with nodes and connections
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [map] = await db.select().from(thoughtMapsTable).where(eq(thoughtMapsTable.id, id));
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
router.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title } = req.body;
    const [map] = await db
      .update(thoughtMapsTable)
      .set({ title, updatedAt: new Date() })
      .where(eq(thoughtMapsTable.id, id))
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
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [map] = await db.delete(thoughtMapsTable).where(eq(thoughtMapsTable.id, id)).returning();
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

// List nodes in a thought map
router.get("/:mapId/nodes", async (req, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const nodes = await db.select().from(nodesTable).where(eq(nodesTable.mapId, mapId)).orderBy(nodesTable.createdAt);
    res.json(nodes);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list nodes" });
  }
});

// Create a node
router.post("/:mapId/nodes", async (req, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const { content = "", positionX = 100, positionY = 100, width = 280, height = 160 } = req.body;
    const [node] = await db
      .insert(nodesTable)
      .values({ mapId, content, positionX, positionY, width, height })
      .returning();
    res.status(201).json(node);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create node" });
  }
});

// Update a node
router.patch("/:mapId/nodes/:nodeId", async (req, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const nodeId = parseInt(req.params.nodeId);
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
router.delete("/:mapId/nodes/:nodeId", async (req, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const nodeId = parseInt(req.params.nodeId);
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
router.get("/:mapId/connections", async (req, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const connections = await db.select().from(connectionsTable).where(eq(connectionsTable.mapId, mapId));
    res.json(connections);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list connections" });
  }
});

// Create a connection
router.post("/:mapId/connections", async (req, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
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
router.delete("/:mapId/connections/:connectionId", async (req, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const connectionId = parseInt(req.params.connectionId);
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

// Ask Claude — SSE streaming
router.post("/:mapId/nodes/:nodeId/ask-claude", async (req, res) => {
  try {
    const mapId = parseInt(req.params.mapId);
    const nodeId = parseInt(req.params.nodeId);
    const { prompt, contextNodeIds } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    // Build context from referenced nodes
    let contextMessages: string[] = [];
    if (contextNodeIds && contextNodeIds.length > 0) {
      const contextNodes = await db
        .select()
        .from(nodesTable)
        .where(eq(nodesTable.mapId, mapId));
      const referenced = contextNodes.filter((n) => contextNodeIds.includes(n.id));
      if (referenced.length > 0) {
        contextMessages = referenced.map((n) => {
          let ctx = `Note content: ${n.content}`;
          if (n.claudeResponse) {
            ctx += `\nClaude's previous response: ${n.claudeResponse}`;
          }
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
      ? `You are a helpful assistant in a mind-mapping and note-taking app called Thought Maps. The user is working on interconnected notes. Here is context from related notes:\n\n${contextMessages.join("\n\n---\n\n")}`
      : "You are a helpful assistant in a mind-mapping and note-taking app called Thought Maps. Help the user think through their ideas clearly and concisely.";

    let fullResponse = "";

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
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

    // Save the full response and clear processing flag
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
