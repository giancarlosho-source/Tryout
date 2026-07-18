import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, clubsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function jwtSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (!s) throw new Error("JWT_SECRET not set");
  return s;
}

// Independently re-parses the Authorization header (rather than trusting
// req.clubId) because a few auth.ts routes — /auth/logo, /auth/club — are
// exempt from requireAuth's JWT check internally but still need subscription
// gating enforced here. Genuinely public/pre-auth routes (login, status,
// forgot-password, ...) reach this middleware with no Authorization header
// at all, so a missing header intentionally passes through — but a header
// that IS present and fails to verify must reject, not silently proceed.
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) { next(); return; }

  let clubId: number;
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret()) as { clubId: number };
    clubId = payload.clubId;
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  try {
    const [club] = await db.select({
      status: clubsTable.status,
      trialEndsAt: clubsTable.trialEndsAt,
    }).from(clubsTable).where(eq(clubsTable.id, clubId));
    if (!club) { res.status(401).json({ error: "Club not found." }); return; }
    if (club.status === "active") { next(); return; }
    if (club.status === "trial") {
      const trialEnd = club.trialEndsAt ? new Date(club.trialEndsAt) : null;
      if (!trialEnd || trialEnd > new Date()) { next(); return; }
      res.status(402).json({ error: "Your trial has expired. Please contact us to activate your account.", code: "TRIAL_EXPIRED" });
      return;
    }
    if (club.status === "past_due") {
      res.status(402).json({ error: "Your account is past due. Please contact us to restore access.", code: "PAST_DUE" });
      return;
    }
    if (club.status === "cancelled") {
      res.status(402).json({ error: "Your account has been cancelled.", code: "CANCELLED" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify subscription status." });
  }
}
