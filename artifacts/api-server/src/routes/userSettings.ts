import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

// Get user settings (or create defaults)
router.get("/", async (req: any, res) => {
  try {
    const userId = req.userId;
    let [settings] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));
    if (!settings) {
      [settings] = await db
        .insert(userSettingsTable)
        .values({ userId, preferredModel: "claude-sonnet-4-6" })
        .returning();
    }
    res.json(settings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get user settings" });
  }
});

// Update user settings
router.put("/", async (req: any, res) => {
  try {
    const userId = req.userId;
    const { preferredModel, customApiKey, customBaseUrl } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (preferredModel !== undefined) updates.preferredModel = preferredModel;
    if (customApiKey !== undefined) updates.customApiKey = customApiKey || null;
    if (customBaseUrl !== undefined) updates.customBaseUrl = customBaseUrl || null;

    // Upsert
    let [settings] = await db
      .insert(userSettingsTable)
      .values({ userId, preferredModel: preferredModel ?? "claude-sonnet-4-6", customApiKey: customApiKey || null, customBaseUrl: customBaseUrl || null })
      .onConflictDoUpdate({ target: userSettingsTable.userId, set: updates })
      .returning();

    res.json(settings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update user settings" });
  }
});

export default router;
