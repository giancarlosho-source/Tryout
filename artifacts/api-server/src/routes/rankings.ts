import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, playersTable, evaluationsTable, clubsTable } from "@workspace/db";
import {
  ListRankingsQueryParams,
  OverrideRankingParams,
  OverrideRankingBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Public: rankings by club slug (no auth — used by evaluation station's read-only rankings/compare view)
router.get("/rankings/public/:slug", async (req, res): Promise<void> => {
  const [club] = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.slug, req.params.slug));
  if (!club) { res.status(404).json({ error: "Club not found." }); return; }

  const clubId = club.id;
  const players = await db.select({
    id: playersTable.id,
    name: playersTable.name,
    jerseyNumber: playersTable.jerseyNumber,
    position: playersTable.position,
    checkedIn: playersTable.checkedIn,
    overallScore: playersTable.overallScore,
    positionScore: playersTable.positionScore,
    potentialScore: playersTable.potentialScore,
    physicalScore: playersTable.physicalScore,
  }).from(playersTable).where(eq(playersTable.clubId, clubId));

  const evalCounts = await db.select().from(evaluationsTable).where(eq(evaluationsTable.clubId, clubId));
  const countByPlayer: Record<number, number> = {};
  evalCounts.forEach((e) => {
    countByPlayer[e.playerId] = (countByPlayer[e.playerId] || 0) + 1;
  });

  const sorted = [...players].sort((a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1));
  const result = sorted.map((p, idx) => ({
    ...p,
    rankOverall: idx + 1,
    evaluationCount: countByPlayer[p.id] || 0,
  }));

  res.json(result);
});

router.get("/rankings", async (req, res): Promise<void> => {
  const params = ListRankingsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clubId = req.clubId;
  let players = await db.select().from(playersTable).where(eq(playersTable.clubId, clubId));

  if (params.data.position) {
    players = players.filter((p) => p.position === params.data.position);
  }

  const evalCounts = await db.select().from(evaluationsTable).where(eq(evaluationsTable.clubId, clubId));
  const countByPlayer: Record<number, number> = {};
  evalCounts.forEach((e) => {
    countByPlayer[e.playerId] = (countByPlayer[e.playerId] || 0) + 1;
  });

  const sortBy = params.data.sortBy || "overall";
  const sortDir = params.data.sortDir || "desc";

  const sorted = [...players].sort((a, b) => {
    let aVal: number | null | string = null;
    let bVal: number | null | string = null;

    switch (sortBy) {
      case "overall":
        aVal = a.overallScore ?? -1;
        bVal = b.overallScore ?? -1;
        break;
      case "position":
        aVal = a.positionScore ?? -1;
        bVal = b.positionScore ?? -1;
        break;
      case "potential":
        aVal = a.potentialScore ?? -1;
        bVal = b.potentialScore ?? -1;
        break;
      case "height":
        aVal = a.heightInches ?? -1;
        bVal = b.heightInches ?? -1;
        break;
      case "physical":
        aVal = a.physicalScore ?? -1;
        bVal = b.physicalScore ?? -1;
        break;
      case "vertical":
        aVal = a.verticalJumpInches ?? -1;
        bVal = b.verticalJumpInches ?? -1;
        break;
      case "jerseyNumber":
        aVal = parseInt(a.jerseyNumber ?? "") || 0;
        bVal = parseInt(b.jerseyNumber ?? "") || 0;
        break;
    }

    if (sortDir === "desc") {
      return (bVal as number) - (aVal as number);
    }
    return (aVal as number) - (bVal as number);
  });

  const result = sorted.map((p, idx) => ({
    ...p,
    rankOverall: idx + 1,
    evaluationCount: countByPlayer[p.id] || 0,
  }));

  res.json(result);
});

router.patch("/rankings/:playerId/override", async (req, res): Promise<void> => {
  const params = OverrideRankingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = OverrideRankingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const clubId = req.clubId;
  const [player] = await db
    .update(playersTable)
    .set({
      rankOverridePosition: parsed.data.rankOverridePosition ?? null,
      rankLocked: parsed.data.rankLocked ?? false,
    })
    .where(and(eq(playersTable.id, params.data.playerId), eq(playersTable.clubId, clubId)))
    .returning();

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const evalCounts = await db.select().from(evaluationsTable).where(eq(evaluationsTable.clubId, clubId));
  const countByPlayer: Record<number, number> = {};
  evalCounts.forEach((e) => {
    countByPlayer[e.playerId] = (countByPlayer[e.playerId] || 0) + 1;
  });

  res.json({
    ...player,
    evaluationCount: countByPlayer[player.id] || 0,
  });
});

export default router;
