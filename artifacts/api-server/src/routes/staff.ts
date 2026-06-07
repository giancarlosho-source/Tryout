import { Router, type IRouter } from "express";
import { db, coachesTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

// List all coaches that have a PIN set (for iPad login)
router.get("/staff", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({ id: coachesTable.id, name: coachesTable.name, role: coachesTable.stationRole, createdAt: coachesTable.createdAt })
      .from(coachesTable)
      .where(isNotNull(coachesTable.pin))
      .orderBy(coachesTable.name);
    res.json(rows.map((r) => ({ ...r, role: r.role ?? "evaluator" })));
  } catch {
    res.status(500).json({ error: "Database not ready. Restart the app to apply the latest schema." });
  }
});

// List all coaches (for Staff & Roles page — shows everyone with pin status)
router.get("/staff/all", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({ id: coachesTable.id, name: coachesTable.name, teamName: coachesTable.teamName, hasPin: coachesTable.pin, stationRole: coachesTable.stationRole })
      .from(coachesTable)
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

  const { pin, stationRole } = req.body ?? {};

  if (pin !== null && pin !== undefined && !/^\d{4}$/.test(String(pin))) {
    res.status(400).json({ error: "PIN must be exactly 4 digits." });
    return;
  }

  await db.update(coachesTable)
    .set({ pin: pin ? String(pin) : null, stationRole: stationRole ?? null })
    .where(eq(coachesTable.id, id));

  res.json({ ok: true });
});

// Verify PIN — returns role on success, 401 on failure
router.post("/staff/auth", async (req, res): Promise<void> => {
  const { id, pin } = req.body ?? {};
  if (!id || !pin) { res.status(400).json({ error: "Missing id or pin." }); return; }

  const [member] = await db
    .select()
    .from(coachesTable)
    .where(eq(coachesTable.id, parseInt(id)));

  if (!member || member.pin !== String(pin)) {
    res.status(401).json({ error: "Incorrect PIN." });
    return;
  }

  res.json({ ok: true, id: member.id, name: member.name, role: member.stationRole ?? "evaluator" });
});

export default router;
