import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, clubsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function jwtSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (!s) throw new Error("JWT_SECRET not set");
  return s;
}

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers["authorization"];
    if (!header?.startsWith("Bearer ")) { next(); return; }
    const secret = process.env["JWT_SECRET"];
    if (!secret) { next(); return; }
    const payload = jwt.verify(header.slice(7), jwtSecret()) as { clubId: number };
    const [club] = await db.select({
      status: clubsTable.status,
      trialEndsAt: clubsTable.trialEndsAt,
    }).from(clubsTable).where(eq(clubsTable.id, payload.clubId));
    if (!club) { next(); return; }
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
    next();
  }
}
