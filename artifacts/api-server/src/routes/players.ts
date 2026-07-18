import { Router, type IRouter } from "express";
import { eq, and, isNull, or, sql, inArray } from "drizzle-orm";
import { db, playersTable, evaluationsTable, coachNotesTable, clubsTable } from "@workspace/db";
import {
  ListPlayersQueryParams,
  CreatePlayerBody,
  GetPlayerParams,
  UpdatePlayerParams,
  UpdatePlayerBody,
  DeletePlayerParams,
  ImportPlayersCsvBody,
} from "@workspace/api-zod";
import { recomputeAllScores } from "../scoring";
import { broadcast } from "../events";

const router: IRouter = Router();

function normalizeAge(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toUpperCase().replace(/\s/g, "");
  const num = s.endsWith("U") ? s.slice(0, -1) : s;
  if (!/^\d+$/.test(num)) return null;
  return `${num}U`;
}


function calcOverallScore(evals: { category: string; skill: string; score: number }[]): number | null {
  if (evals.length === 0) return null;
  const universalEvals = evals.filter((e) => e.category === "universal");
  if (universalEvals.length === 0) return null;
  const avg = universalEvals.reduce((sum, e) => sum + e.score, 0) / universalEvals.length;
  return Math.round(avg * 10) / 10;
}

function calcPositionScore(evals: { category: string; skill: string; score: number }[]): number | null {
  const positionEvals = evals.filter((e) => e.category === "position");
  if (positionEvals.length === 0) return null;
  const avg = positionEvals.reduce((sum, e) => sum + e.score, 0) / positionEvals.length;
  return Math.round(avg * 10) / 10;
}

function calcPotentialScore(
  evals: { category: string; skill: string; score: number }[],
  player: { heightInches?: number | null; verticalJumpInches?: number | null }
): number | null {
  const athleticSkills = ["Competitiveness", "Coachability", "Vertical", "Physical upside"];
  const athleticEvals = evals.filter((e) => athleticSkills.includes(e.skill));
  const physicalBonus =
    (player.verticalJumpInches && player.verticalJumpInches > 28 ? 0.5 : 0) +
    (player.heightInches && player.heightInches > 72 ? 0.3 : 0);
  if (athleticEvals.length === 0) return null;
  const avg = athleticEvals.reduce((sum, e) => sum + e.score, 0) / athleticEvals.length;
  return Math.min(10, Math.round((avg + physicalBonus) * 10) / 10);
}

// Public: list players by club slug (no auth — used by station tablets)
router.get("/players/public/:slug", async (req, res): Promise<void> => {
  const [club] = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.slug, req.params.slug));
  if (!club) { res.status(404).json({ error: "Club not found." }); return; }
  const players = await db.select({
    id: playersTable.id,
    name: playersTable.name,
    jerseyNumber: playersTable.jerseyNumber,
    position: playersTable.position,
    age: playersTable.age,
    checkedIn: playersTable.checkedIn,
  }).from(playersTable).where(eq(playersTable.clubId, club.id)).orderBy(playersTable.jerseyNumber);
  res.json(players);
});

router.get("/players", async (req, res): Promise<void> => {
  const params = ListPlayersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clubId = req.clubId;
  let query = db.select().from(playersTable).where(eq(playersTable.clubId, clubId)).$dynamic();

  if (params.data.position) {
    query = query.where(
      and(
        eq(playersTable.clubId, clubId),
        or(
          eq(playersTable.position, params.data.position),
          sql`${playersTable.position} ILIKE ${params.data.position + "/%"}`
        )
      )
    );
  }

  if (params.data.checkedIn !== undefined) {
    query = query.where(and(eq(playersTable.clubId, clubId), eq(playersTable.checkedIn, params.data.checkedIn)));
  }

  let players = await query.orderBy(playersTable.jerseyNumber);

  if (params.data.missingMeasurements) {
    players = players.filter(
      (p) => p.heightInches == null || p.standingReachInches == null || p.verticalJumpInches == null
    );
  }

  res.json(players);
});

// POST /players/bulk-checkin — check in multiple players by jersey number in one shot
router.post("/players/bulk-checkin", async (req, res): Promise<void> => {
  const { jerseyNumbers } = req.body as { jerseyNumbers?: unknown };
  if (!Array.isArray(jerseyNumbers) || jerseyNumbers.length === 0) {
    res.status(400).json({ error: "jerseyNumbers must be a non-empty array" });
    return;
  }
  const clubId = req.clubId;
  const nums = jerseyNumbers.map(String).filter(Boolean);
  const updated = await db
    .update(playersTable)
    .set({ checkedIn: true })
    .where(and(eq(playersTable.clubId, clubId), inArray(playersTable.jerseyNumber, nums)))
    .returning({ id: playersTable.id, jerseyNumber: playersTable.jerseyNumber, name: playersTable.name });

  const found = new Set(updated.map((p) => p.jerseyNumber));
  const notFound = nums.filter((n) => !found.has(n));

  broadcast("players:changed");
  res.json({ checked: updated, notFound });
});

router.post("/players", async (req, res): Promise<void> => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const clubId = req.clubId;
  const [player] = await db.insert(playersTable).values({ ...parsed.data, age: normalizeAge(parsed.data.age), clubId }).returning();
  broadcast("players:changed");
  res.status(201).json(player);
});

router.post("/players/import-csv", async (req, res): Promise<void> => {
  const parsed = ImportPlayersCsvBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const clubId = req.clubId;
  const lines = parsed.data.csvData.trim().split("\n");
  if (lines.length < 2) {
    res.json({ imported: 0, updated: 0, errors: ["CSV must have a header row and at least one data row"] });
    return;
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const errors: string[] = [];
  let imported = 0;
  let updated = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });

    const jersey = row["jerseynumber"] || row["jersey"] || row["#"];
    // Support "First Name" + "Last Name" columns as well as a single "name" column
    const firstName = row["first name"] || row["firstname"] || "";
    const lastName = row["last name"] || row["lastname"] || "";
    const name = row["playername"] || row["name"] || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName);
    // Support "Pos 1" / "Pos 2" as well as "position" / "pos"
    const position = row["position"] || row["pos"] || row["pos 1"] || row["pos1"] || row["pos 2"] || row["pos2"];

    if (!jersey || !name) {
      errors.push(`Row ${i + 1}: Missing required fields (jerseyNumber, name)`);
      continue;
    }

    const positionMap: Record<string, string> = {
      setter: "Setter", s: "Setter", "setter/pin": "Setter", "setter/ds": "Setter",
      "outside hitter": "OutsideHitter", oh: "OutsideHitter", outside: "OutsideHitter",
      pin: "OutsideHitter", "pin/setter": "OutsideHitter", "pin/mb": "OutsideHitter", "pin/ds": "OutsideHitter",
      "middle blocker": "MiddleBlocker", mb: "MiddleBlocker", middle: "MiddleBlocker", "mb/pin": "MiddleBlocker",
      opposite: "Opposite", opp: "Opposite", rs: "Opposite",
      libero: "Libero", l: "Libero", ds: "Libero", "ds/l": "Libero", "libero/ds": "Libero",
      "ds/setter": "Libero", "ds/pin": "Libero",
      undecided: "Undecided", tbd: "Undecided", unknown: "Undecided",
    };

    const mappedPosition = position ? (positionMap[position.toLowerCase()] || position) : undefined;

    const playerData = {
      clubId,
      jerseyNumber: jersey,
      name,
      position: mappedPosition ?? null,
      checkedIn: (row["checkedinstatus"] || row["checkedin"] || "").toLowerCase() === "true" || false,
      age: normalizeAge(row["age"]),
      heightInches: row["height"] ? parseFloat(row["height"]) || null : null,
      standingReachInches: row["standingreachinches"] || row["reach"] ? parseFloat(row["standingreachinches"] || row["reach"]) || null : null,
      verticalJumpInches: row["verticaljump"] || row["vertical"] ? parseFloat(row["verticaljump"] || row["vertical"]) || null : null,
    };

    try {
      const existing = await db
        .select()
        .from(playersTable)
        .where(and(eq(playersTable.clubId, clubId), eq(playersTable.jerseyNumber, jersey)));

      if (existing.length > 0) {
        await db
          .update(playersTable)
          .set({
            name: playerData.name,
            position: playerData.position,
            checkedIn: playerData.checkedIn,
            age: playerData.age,
            heightInches: playerData.heightInches,
            standingReachInches: playerData.standingReachInches,
            verticalJumpInches: playerData.verticalJumpInches,
          })
          .where(and(eq(playersTable.clubId, clubId), eq(playersTable.jerseyNumber, jersey)));
        updated++;
      } else {
        await db.insert(playersTable).values(playerData);
        imported++;
      }
    } catch {
      errors.push(`Row ${i + 1}: Failed to import player ${name}`);
    }
  }

  if (imported > 0 || updated > 0) {
    await recomputeAllScores();
    broadcast("players:changed");
  }

  res.json({ imported, updated, errors });
});

router.get("/players/stats", async (req, res): Promise<void> => {
  const clubId = req.clubId;
  const players = await db.select().from(playersTable).where(eq(playersTable.clubId, clubId));
  const total = players.length;
  const checkedIn = players.filter((p) => p.checkedIn).length;
  const missing = players.filter(
    (p) => p.heightInches == null || p.standingReachInches == null || p.verticalJumpInches == null
  ).length;

  const evals = await db.select().from(evaluationsTable).where(eq(evaluationsTable.clubId, clubId));
  const evaluatedPlayerIds = new Set(evals.map((e) => e.playerId));
  const evaluated = players.filter((p) => evaluatedPlayerIds.has(p.id)).length;

  const byPosition: Record<string, number> = {};
  players.forEach((p) => {
    byPosition[p.position] = (byPosition[p.position] || 0) + 1;
  });

  res.json({
    totalPlayers: total,
    checkedIn,
    evaluated,
    missingMeasurements: missing,
    byPosition: Object.entries(byPosition).map(([position, count]) => ({ position, count })),
  });
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clubId = req.clubId;
  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, params.data.id), eq(playersTable.clubId, clubId)));

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const evaluations = await db
    .select()
    .from(evaluationsTable)
    .where(and(eq(evaluationsTable.playerId, params.data.id), eq(evaluationsTable.clubId, clubId)));

  const notes = await db
    .select()
    .from(coachNotesTable)
    .where(and(eq(coachNotesTable.playerId, params.data.id), eq(coachNotesTable.clubId, clubId)))
    .orderBy(coachNotesTable.createdAt);

  res.json({ ...player, evaluations, notes });
});

router.patch("/players/:id", async (req, res): Promise<void> => {
  const params = UpdatePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const clubId = req.clubId;
  const updateData = parsed.data.age !== undefined
    ? { ...parsed.data, age: normalizeAge(parsed.data.age) }
    : parsed.data;
  const [player] = await db
    .update(playersTable)
    .set(updateData)
    .where(and(eq(playersTable.id, params.data.id), eq(playersTable.clubId, clubId)))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  broadcast("players:changed");
  res.json(player);
});

// DELETE /players/all — wipe all players, evaluations, notes, roster data (must be before /:id)
router.delete("/players/all", async (req, res): Promise<void> => {
  const clubId = req.clubId;
  await db.delete(evaluationsTable).where(eq(evaluationsTable.clubId, clubId));
  await db.delete(coachNotesTable).where(eq(coachNotesTable.clubId, clubId));
  await db.delete(playersTable).where(eq(playersTable.clubId, clubId));
  req.log.info("All players deleted");
  broadcast("players:changed");
  res.sendStatus(204);
});

router.delete("/players/:id", async (req, res): Promise<void> => {
  const params = DeletePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clubId = req.clubId;
  const [player] = await db
    .delete(playersTable)
    .where(and(eq(playersTable.id, params.data.id), eq(playersTable.clubId, clubId)))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  broadcast("players:changed");
  res.sendStatus(204);
});

export { calcOverallScore, calcPositionScore, calcPotentialScore };
export default router;
