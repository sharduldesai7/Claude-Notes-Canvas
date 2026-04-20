import { Router, type IRouter } from "express";
import { db, guestSessionsTable, thoughtMapsTable, nodesTable, connectionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const router: IRouter = Router();

const SESSION_DURATION_MS = 30 * 60 * 1000;

function generateToken(length = 48): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

router.post("/", async (req: any, res) => {
  try {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const [session] = await db.insert(guestSessionsTable).values({ token, expiresAt }).returning();
    res.status(201).json({ token: session.token, expiresAt: session.expiresAt });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create guest session" });
  }
});

async function deleteGuestSession(token: string) {
  const guestUserId = `guest_${token}`;
  await db.delete(thoughtMapsTable).where(eq(thoughtMapsTable.userId, guestUserId));
  await db.delete(guestSessionsTable).where(eq(guestSessionsTable.token, token));
}

router.delete("/:token", async (req: any, res) => {
  try {
    await deleteGuestSession(req.params.token);
    res.status(204).send();
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "Failed to delete guest session" });
  }
});

// POST /:token/cleanup — for sendBeacon (tab close), which can only send POST
router.post("/:token/cleanup", async (req: any, res) => {
  try {
    await deleteGuestSession(req.params.token);
    res.status(204).send();
  } catch {
    res.status(204).send();
  }
});

export async function cleanupExpiredGuestSessions() {
  try {
    const expired = await db
      .select({ token: guestSessionsTable.token })
      .from(guestSessionsTable)
      .where(lt(guestSessionsTable.expiresAt, new Date()));

    for (const { token } of expired) {
      await db.delete(thoughtMapsTable).where(eq(thoughtMapsTable.userId, `guest_${token}`));
      await db.delete(guestSessionsTable).where(eq(guestSessionsTable.token, token));
    }
  } catch {
  }
}

export default router;
