import { Router, type IRouter } from "express";
import { eq, and, isNull, or, sql } from "drizzle-orm";
import { db, playersTable, evaluationsTable, coachNotesTable } from "@workspace/db";
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

const router: IRouter = Router();

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

router.get("/players", async (req, res): Promise<void> => {
  const params = ListPlayersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(playersTable).$dynamic();

  if (params.data.position) {
    // Match exact OR first position in a slash-separated combo (e.g. "Setter/DS" → Setter tab)
    query = query.where(
      or(
        eq(playersTable.position, params.data.position),
        sql`${playersTable.position} ILIKE ${params.data.position + "/%"}`
      )
    );
  }

  if (params.data.checkedIn !== undefined) {
    query = query.where(eq(playersTable.checkedIn, params.data.checkedIn));
  }

  let players = await query.orderBy(playersTable.jerseyNumber);

  if (params.data.missingMeasurements) {
    players = players.filter(
      (p) => p.heightInches == null || p.standingReachInches == null || p.verticalJumpInches == null
    );
  }

  res.json(players);
});

router.post("/players", async (req, res): Promise<void> => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [player] = await db.insert(playersTable).values(parsed.data).returning();
  res.status(201).json(player);
});

router.post("/players/import-csv", async (req, res): Promise<void> => {
  const parsed = ImportPlayersCsvBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

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
    const name = row["playername"] || row["name"];
    const position = row["position"] || row["pos"];

    if (!jersey || !name || !position) {
      errors.push(`Row ${i + 1}: Missing required fields (jerseyNumber, name, position)`);
      continue;
    }

    const positionMap: Record<string, string> = {
      setter: "Setter",
      s: "Setter",
      "outside hitter": "OutsideHitter",
      oh: "OutsideHitter",
      outside: "OutsideHitter",
      "middle blocker": "MiddleBlocker",
      mb: "MiddleBlocker",
      middle: "MiddleBlocker",
      opposite: "Opposite",
      opp: "Opposite",
      rs: "Opposite",
      libero: "Libero",
      l: "Libero",
      ds: "Libero",
      "libero/ds": "Libero",
    };

    const mappedPosition = positionMap[position.toLowerCase()] || position;

    const playerData = {
      jerseyNumber: jersey,
      name,
      position: mappedPosition,
      checkedIn: (row["checkedinstatus"] || row["checkedin"] || "").toLowerCase() === "true" || false,
      heightInches: row["height"] ? parseFloat(row["height"]) || null : null,
      standingReachInches: row["standingreachinches"] || row["reach"] ? parseFloat(row["standingreachinches"] || row["reach"]) || null : null,
      verticalJumpInches: row["verticaljump"] || row["vertical"] ? parseFloat(row["verticaljump"] || row["vertical"]) || null : null,
    };

    try {
      const existing = await db
        .select()
        .from(playersTable)
        .where(eq(playersTable.jerseyNumber, jersey));

      if (existing.length > 0) {
        await db
          .update(playersTable)
          .set({
            name: playerData.name,
            position: playerData.position,
            checkedIn: playerData.checkedIn,
            heightInches: playerData.heightInches,
            standingReachInches: playerData.standingReachInches,
            verticalJumpInches: playerData.verticalJumpInches,
          })
          .where(eq(playersTable.jerseyNumber, jersey));
        updated++;
      } else {
        await db.insert(playersTable).values(playerData);
        imported++;
      }
    } catch {
      errors.push(`Row ${i + 1}: Failed to import player ${name}`);
    }
  }

  // Recompute all scores since measurements may have changed (physical score is percentile-based)
  if (imported > 0 || updated > 0) {
    await recomputeAllScores();
  }

  res.json({ imported, updated, errors });
});

router.get("/players/stats", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable);
  const total = players.length;
  const checkedIn = players.filter((p) => p.checkedIn).length;
  const missing = players.filter(
    (p) => p.heightInches == null || p.standingReachInches == null || p.verticalJumpInches == null
  ).length;

  const evals = await db.select().from(evaluationsTable);
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

  const [player] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, params.data.id));

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const evaluations = await db
    .select()
    .from(evaluationsTable)
    .where(eq(evaluationsTable.playerId, params.data.id));

  const notes = await db
    .select()
    .from(coachNotesTable)
    .where(eq(coachNotesTable.playerId, params.data.id))
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

  const [player] = await db
    .update(playersTable)
    .set(parsed.data)
    .where(eq(playersTable.id, params.data.id))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(player);
});

// DELETE /players/all — wipe all players, evaluations, notes, roster data (must be before /:id)
router.delete("/players/all", async (req, res): Promise<void> => {
  await db.delete(evaluationsTable);
  await db.delete(coachNotesTable);
  await db.delete(playersTable);
  req.log.info("All players deleted");
  res.sendStatus(204);
});

router.delete("/players/:id", async (req, res): Promise<void> => {
  const params = DeletePlayerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [player] = await db
    .delete(playersTable)
    .where(eq(playersTable.id, params.data.id))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.sendStatus(204);
});

export { calcOverallScore, calcPositionScore, calcPotentialScore };
export default router;
