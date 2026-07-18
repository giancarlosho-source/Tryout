import { Router, type IRouter } from "express";
import { eq, isNotNull, and, ne } from "drizzle-orm";
import { db, coachesTable, rostersTable, rosterPlayersTable, playersTable, coachWishlistTable, coachMustHaveTable } from "@workspace/db";
import jwt from "jsonwebtoken";
import { broadcast } from "../events";

const router: IRouter = Router();

function getClubId(req: { headers: { authorization?: string } }): number {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) throw new Error("No token");
  const payload = jwt.verify(header.slice(7), process.env["JWT_SECRET"]!) as { clubId: number };
  return payload.clubId;
}

const parseCoach = (c: typeof coachesTable.$inferSelect) => ({
  ...c,
  draftPriority: (() => { try { return JSON.parse(c.draftPriority); } catch { return []; } })(),
});

router.get("/coaches", async (req, res): Promise<void> => {
  const clubId = getClubId(req);
  const coaches = await db.select().from(coachesTable).where(eq(coachesTable.clubId, clubId)).orderBy(coachesTable.teamName);
  res.json(coaches.map(parseCoach));
});

router.post("/coaches", async (req, res): Promise<void> => {
  const { name, teamName, draftPriority } = req.body as { name?: string; teamName?: string; draftPriority?: string[] };
  if (!name?.trim() || !teamName?.trim()) {
    res.status(400).json({ error: "name and teamName are required" });
    return;
  }
  const clubId = getClubId(req);
  const priorityJson = JSON.stringify(Array.isArray(draftPriority) ? draftPriority : []);
  const [coach] = await db.insert(coachesTable).values({ clubId, name: name.trim(), teamName: teamName.trim(), draftPriority: priorityJson }).returning();
  broadcast("players:changed");
  res.status(201).json({ ...coach, draftPriority: JSON.parse(coach.draftPriority) });
});

router.post("/coaches/import", async (req, res): Promise<void> => {
  const { csvData } = req.body as { csvData?: string };
  if (!csvData?.trim()) {
    res.status(400).json({ error: "csvData is required" });
    return;
  }
  const lines = csvData.trim().split("\n").filter(Boolean);
  if (lines.length < 2) {
    res.json({ imported: 0, updated: 0, errors: ["CSV must have a header row and at least one data row"] });
    return;
  }
  const clubId = getClubId(req);
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const errors: string[] = [];
  let imported = 0;
  let updated = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });

    const name = row["coachname"] || row["name"] || row["coach"];
    const teamName = row["teamname"] || row["team"];

    if (!name || !teamName) {
      errors.push(`Row ${i + 1}: Missing required fields (name/coachName, teamName/team)`);
      continue;
    }

    try {
      const existing = await db.select().from(coachesTable).where(and(eq(coachesTable.clubId, clubId), eq(coachesTable.teamName, teamName)));
      if (existing.length > 0) {
        await db.update(coachesTable).set({ name, teamName }).where(and(eq(coachesTable.clubId, clubId), eq(coachesTable.teamName, teamName)));
        updated++;
      } else {
        await db.insert(coachesTable).values({ clubId, name, teamName });
        imported++;
      }
    } catch {
      errors.push(`Row ${i + 1}: Failed to import coach ${name}`);
    }
  }

  broadcast("players:changed");
  res.json({ imported, updated, errors });
});

// Get all draft picks across all coaches (for the claimed overlay)
router.get("/coaches/draft/all", async (req, res): Promise<void> => {
  const clubId = getClubId(req);
  const allCoaches = await db.select().from(coachesTable).where(eq(coachesTable.clubId, clubId));
  const allRosters = await db.select().from(rostersTable).where(and(eq(rostersTable.clubId, clubId), isNotNull(rostersTable.coachId)));

  if (!allRosters.length) { res.json([]); return; }

  const picks: { playerId: number; coachId: number; coachName: string; teamName: string; position: string }[] = [];
  for (const roster of allRosters) {
    const coach = allCoaches.find((c) => c.id === roster.coachId);
    if (!coach) continue;
    const players = await db.select().from(rosterPlayersTable).where(eq(rosterPlayersTable.rosterId, roster.id));
    for (const p of players) {
      picks.push({ playerId: p.playerId, coachId: coach.id, coachName: coach.name, teamName: coach.teamName, position: p.position, committed: p.committed, locked: p.locked });
    }
  }

  res.json(picks);
});

router.delete("/coaches/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const clubId = getClubId(req);
  await db.delete(coachesTable).where(and(eq(coachesTable.id, id), eq(coachesTable.clubId, clubId)));
  broadcast("players:changed");
  res.status(204).send();
});

// Get or create a coach's draft roster
router.get("/coaches/:id/draft", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  if (isNaN(coachId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const clubId = getClubId(req);
  const [coach] = await db.select().from(coachesTable).where(and(eq(coachesTable.id, coachId), eq(coachesTable.clubId, clubId)));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }

  let rosters = await db.select().from(rostersTable).where(and(eq(rostersTable.clubId, clubId), eq(rostersTable.coachId, coachId)));
  if (!rosters.length) {
    const [created] = await db.insert(rostersTable).values({
      clubId,
      name: `${coach.teamName} Draft`,
      coachId,
    }).returning();
    rosters = [created];
  }

  const roster = rosters[0];
  const rosterPlayers = await db
    .select({ rosterPlayer: rosterPlayersTable, player: playersTable })
    .from(rosterPlayersTable)
    .innerJoin(playersTable, eq(rosterPlayersTable.playerId, playersTable.id))
    .where(eq(rosterPlayersTable.rosterId, roster.id));

  res.json({
    roster,
    coach: parseCoach(coach),
    players: rosterPlayers.map((r) => ({ ...r.player, draftPosition: r.rosterPlayer.position, locked: r.rosterPlayer.locked })),
  });
});

// Add player to a coach's draft
router.post("/coaches/:id/draft/players", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  if (isNaN(coachId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { playerId, position } = req.body as { playerId?: number; position?: string };
  if (!playerId || !position) { res.status(400).json({ error: "playerId and position are required" }); return; }

  const clubId = getClubId(req);
  const [coach] = await db.select().from(coachesTable).where(and(eq(coachesTable.id, coachId), eq(coachesTable.clubId, clubId)));
  if (!coach) { res.status(404).json({ error: "Coach not found" }); return; }

  let rosters = await db.select().from(rostersTable).where(and(eq(rostersTable.clubId, clubId), eq(rostersTable.coachId, coachId)));
  if (!rosters.length) {
    const [created] = await db.insert(rostersTable).values({ clubId, name: `${coach.teamName} Draft`, coachId }).returning();
    rosters = [created];
  }
  const rosterId = rosters[0].id;

  const existing = await db.select().from(rosterPlayersTable).where(eq(rosterPlayersTable.rosterId, rosterId));
  if (existing.some((r) => r.playerId === playerId)) {
    res.status(409).json({ error: "Player already on this draft" });
    return;
  }

  await db.insert(rosterPlayersTable).values({ rosterId, playerId, position });
  broadcast("players:changed");
  res.status(201).json({ ok: true });
});

// Remove player from a coach's draft
router.delete("/coaches/:id/draft/players/:playerId", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(coachId) || isNaN(playerId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const clubId = getClubId(req);
  const rosters = await db.select().from(rostersTable).where(and(eq(rostersTable.clubId, clubId), eq(rostersTable.coachId, coachId)));
  if (!rosters.length) { res.status(404).json({ error: "No draft found for this coach" }); return; }

  await db.delete(rosterPlayersTable)
    .where(and(eq(rosterPlayersTable.rosterId, rosters[0].id), eq(rosterPlayersTable.playerId, playerId)));

  broadcast("players:changed");
  res.status(204).send();
});

// Toggle lock on a player in a coach's draft
router.patch("/coaches/:id/draft/players/:playerId", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(coachId) || isNaN(playerId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { locked } = req.body as { locked?: boolean };
  if (typeof locked !== "boolean") { res.status(400).json({ error: "locked (boolean) is required" }); return; }

  const clubId = getClubId(req);
  const rosters = await db.select().from(rostersTable).where(and(eq(rostersTable.clubId, clubId), eq(rostersTable.coachId, coachId)));
  if (!rosters.length) { res.status(404).json({ error: "No draft found for this coach" }); return; }

  await db.update(rosterPlayersTable)
    .set({ locked })
    .where(and(eq(rosterPlayersTable.rosterId, rosters[0].id), eq(rosterPlayersTable.playerId, playerId)));

  if (locked) {
    await db.delete(coachWishlistTable)
      .where(and(eq(coachWishlistTable.playerId, playerId), ne(coachWishlistTable.coachId, coachId)));
  }

  broadcast("players:changed");
  res.json({ ok: true });
});

// Mark player as committed
router.post("/coaches/:id/draft/players/:playerId/commit", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(coachId) || isNaN(playerId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const clubId = getClubId(req);
  const rosters = await db.select().from(rostersTable).where(and(eq(rostersTable.clubId, clubId), eq(rostersTable.coachId, coachId)));
  if (!rosters.length) { res.status(404).json({ error: "No draft found for this coach" }); return; }

  await db.update(rosterPlayersTable)
    .set({ committed: true, locked: true })
    .where(and(eq(rosterPlayersTable.rosterId, rosters[0].id), eq(rosterPlayersTable.playerId, playerId)));

  await db.delete(coachWishlistTable).where(eq(coachWishlistTable.playerId, playerId));
  await db.delete(coachMustHaveTable).where(eq(coachMustHaveTable.playerId, playerId));

  broadcast("players:changed");
  res.json({ ok: true });
});

// Get all wishlist picks across all coaches (for conflict detection)
router.get("/coaches/wishlist/all", async (req, res): Promise<void> => {
  const clubId = getClubId(req);
  const all = await db
    .select({
      coachId: coachWishlistTable.coachId,
      playerId: coachWishlistTable.playerId,
      coachName: coachesTable.name,
      teamName: coachesTable.teamName,
    })
    .from(coachWishlistTable)
    .innerJoin(coachesTable, and(eq(coachWishlistTable.coachId, coachesTable.id), eq(coachesTable.clubId, clubId)));
  res.json(all);
});

// Get a coach's wishlist
router.get("/coaches/:id/wishlist", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  if (isNaN(coachId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const entries = await db.select().from(coachWishlistTable).where(eq(coachWishlistTable.coachId, coachId));
  res.json(entries.map((e) => e.playerId));
});

// Add to wishlist
router.post("/coaches/:id/wishlist", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  if (isNaN(coachId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { playerId } = req.body as { playerId?: number };
  if (!playerId) { res.status(400).json({ error: "playerId is required" }); return; }

  await db.insert(coachWishlistTable).values({ coachId, playerId }).onConflictDoNothing();
  broadcast("players:changed");
  res.status(201).json({ ok: true });
});

// Remove from wishlist
router.delete("/coaches/:id/wishlist/:playerId", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(coachId) || isNaN(playerId)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(coachWishlistTable)
    .where(and(eq(coachWishlistTable.coachId, coachId), eq(coachWishlistTable.playerId, playerId)));

  broadcast("players:changed");
  res.status(204).send();
});

// Get all must-have picks across all coaches
router.get("/coaches/musthave/all", async (req, res): Promise<void> => {
  const clubId = getClubId(req);
  const all = await db
    .select({
      coachId: coachMustHaveTable.coachId,
      playerId: coachMustHaveTable.playerId,
      coachName: coachesTable.name,
      teamName: coachesTable.teamName,
    })
    .from(coachMustHaveTable)
    .innerJoin(coachesTable, and(eq(coachMustHaveTable.coachId, coachesTable.id), eq(coachesTable.clubId, clubId)));
  res.json(all);
});

// Get a coach's must-have list
router.get("/coaches/:id/musthave", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  if (isNaN(coachId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const entries = await db.select().from(coachMustHaveTable).where(eq(coachMustHaveTable.coachId, coachId));
  res.json(entries.map((e) => e.playerId));
});

// Add to must-have
router.post("/coaches/:id/musthave", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  if (isNaN(coachId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { playerId } = req.body as { playerId?: number };
  if (!playerId) { res.status(400).json({ error: "playerId is required" }); return; }
  await db.insert(coachMustHaveTable).values({ coachId, playerId }).onConflictDoNothing();
  broadcast("players:changed");
  res.status(201).json({ ok: true });
});

// Remove from must-have
router.delete("/coaches/:id/musthave/:playerId", async (req, res): Promise<void> => {
  const coachId = parseInt(req.params.id);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(coachId) || isNaN(playerId)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(coachMustHaveTable)
    .where(and(eq(coachMustHaveTable.coachId, coachId), eq(coachMustHaveTable.playerId, playerId)));
  broadcast("players:changed");
  res.status(204).send();
});

export default router;
