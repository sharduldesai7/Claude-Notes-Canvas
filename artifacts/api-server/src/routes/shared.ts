import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, thoughtMapsTable, nodesTable, connectionsTable, mapSharesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/:token", async (req: any, res) => {
  try {
    const { token } = req.params;

    const [share] = await db
      .select()
      .from(mapSharesTable)
      .where(eq(mapSharesTable.token, token));

    if (!share) {
      res.status(404).json({ error: "Share link not found or has been revoked" });
      return;
    }

    const [map] = await db
      .select()
      .from(thoughtMapsTable)
      .where(eq(thoughtMapsTable.id, share.mapId));

    if (!map) {
      res.status(404).json({ error: "Map not found" });
      return;
    }

    const nodes = await db
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.mapId, map.id))
      .orderBy(nodesTable.createdAt);

    const connections = await db
      .select()
      .from(connectionsTable)
      .where(eq(connectionsTable.mapId, map.id))
      .orderBy(connectionsTable.createdAt);

    res.json({
      map: { ...map, nodes, connections },
      permission: share.permission,
      shareId: share.id,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to resolve share link" });
  }
});

export default router;
