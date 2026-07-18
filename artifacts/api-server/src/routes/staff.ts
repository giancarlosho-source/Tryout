import { Router, type IRouter } from "express";
import { db, coachesTable, clubsTable } from "@workspace/db";
import { eq, isNotNull, and } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { broadcast } from "../events";

const router: IRouter = Router();

function getClubId(req: { headers: { authorization?: string } }): number {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) throw new Error("No token");
  const payload = jwt.verify(header.slice(7), process.env["JWT_SECRET"]!) as { clubId: number };
  return payload.clubId;
}

// Public endpoint — fetch staff by club slug (no auth needed, safe for bookmarked station URLs)
router.get("/staff/public/:slug", async (req, res): Promise<void> => {
  try {
    const [club] = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.slug, req.params.slug));
    if (!club) { res.status(404).json({ error: "Club not found." }); return; }
    const rows = await db
      .select({ id: coachesTable.id, name: coachesTable.name, role: coachesTable.stationRole })
      .from(coachesTable)
      .where(and(eq(coachesTable.clubId, club.id), isNotNull(coachesTable.pin)))
      .orderBy(coachesTable.name);
    res.json(rows.map((r) => ({ ...r, role: r.role ?? "evaluator" })));
  } catch {
    res.status(500).json({ error: "Server error." });
  }
});

// List all coaches that have a PIN set (for iPad login)
router.get("/staff", async (req, res): Promise<void> => {
  try {
    const clubId = getClubId(req);
    const rows = await db
      .select({ id: coachesTable.id, name: coachesTable.name, role: coachesTable.stationRole, createdAt: coachesTable.createdAt })
      .from(coachesTable)
      .where(and(eq(coachesTable.clubId, clubId), isNotNull(coachesTable.pin)))
      .orderBy(coachesTable.name);
    res.json(rows.map((r) => ({ ...r, role: r.role ?? "evaluator" })));
  } catch {
    res.status(500).json({ error: "Database not ready. Restart the app to apply the latest schema." });
  }
});

// List all coaches (for Staff & Roles page — shows everyone with pin status)
router.get("/staff/all", async (req, res): Promise<void> => {
  try {
    const clubId = getClubId(req);
    const rows = await db
      .select({ id: coachesTable.id, name: coachesTable.name, teamName: coachesTable.teamName, hasPin: coachesTable.pin, stationRole: coachesTable.stationRole })
      .from(coachesTable)
      .where(eq(coachesTable.clubId, clubId))
      .orderBy(coachesTable.name);
    res.json(rows.map((r) => ({ ...r, hasPin: !!r.hasPin })));
  } catch {
    res.status(500).json({ error: "Database not ready. Restart the app to apply the latest schema." });
  }
});

// Set or clear PIN for a coach
router.patch("/staff/:id/pin", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }

  const clubId = getClubId(req);
  const { pin, stationRole } = req.body ?? {};

  if (pin !== null && pin !== undefined && !/^\d{4}$/.test(String(pin))) {
    res.status(400).json({ error: "PIN must be exactly 4 digits." });
    return;
  }

  await db.update(coachesTable)
    .set({ pin: pin ? String(pin) : null, stationRole: stationRole ?? null })
    .where(and(eq(coachesTable.id, id), eq(coachesTable.clubId, clubId)));

  broadcast("players:changed");
  res.json({ ok: true });
});

// Public PIN verify by club slug (for bookmarked station URLs)
router.post("/staff/public/:slug/auth", async (req, res): Promise<void> => {
  const { id, pin } = req.body ?? {};
  if (!id || !pin) { res.status(400).json({ error: "Missing id or pin." }); return; }
  try {
    const [club] = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.slug, req.params.slug));
    if (!club) { res.status(404).json({ error: "Club not found." }); return; }
    const [member] = await db
      .select()
      .from(coachesTable)
      .where(and(eq(coachesTable.id, parseInt(id)), eq(coachesTable.clubId, club.id)));
    if (!member || member.pin !== String(pin)) {
      res.status(401).json({ error: "Incorrect PIN." });
      return;
    }
    // Issue a club-scoped JWT so station tablets can submit evaluations
    const clubToken = jwt.sign({ clubId: club.id }, process.env["JWT_SECRET"]!, { expiresIn: "24h" });
    res.json({ ok: true, id: member.id, name: member.name, role: member.stationRole ?? "evaluator", clubToken });
  } catch {
    res.status(500).json({ error: "Server error." });
  }
});

// Verify PIN — returns role on success, 401 on failure
router.post("/staff/auth", async (req, res): Promise<void> => {
  const { id, pin } = req.body ?? {};
  if (!id || !pin) { res.status(400).json({ error: "Missing id or pin." }); return; }

  const clubId = getClubId(req);
  const [member] = await db
    .select()
    .from(coachesTable)
    .where(and(eq(coachesTable.id, parseInt(id)), eq(coachesTable.clubId, clubId)));

  if (!member || member.pin !== String(pin)) {
    res.status(401).json({ error: "Incorrect PIN." });
    return;
  }

  res.json({ ok: true, id: member.id, name: member.name, role: member.stationRole ?? "evaluator" });
});

export default router;
