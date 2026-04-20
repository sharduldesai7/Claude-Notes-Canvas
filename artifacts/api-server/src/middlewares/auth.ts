import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { db, guestSessionsTable } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}

export async function requireAuthOrGuest(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (auth?.userId) {
    (req as any).userId = auth.userId;
    (req as any).isGuest = false;
    return next();
  }

  const guestToken = req.headers["x-guest-token"] as string | undefined;
  if (guestToken) {
    const [session] = await db
      .select()
      .from(guestSessionsTable)
      .where(and(eq(guestSessionsTable.token, guestToken), gt(guestSessionsTable.expiresAt, new Date())));
    if (session) {
      (req as any).userId = `guest_${guestToken}`;
      (req as any).isGuest = true;
      return next();
    }
    res.status(401).json({ error: "Guest session expired" });
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}

export function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth?.userId ?? null;
}
