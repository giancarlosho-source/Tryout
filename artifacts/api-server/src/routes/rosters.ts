import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, playersTable, rostersTable, rosterPlayersTable, evaluationsTable } from "@workspace/db";
import {
  GetRosterParams,
  UpdateRosterParams,
  UpdateRosterBody,
  CreateRosterBody,
  AddPlayerToRosterParams,
  AddPlayerToRosterBody,
  RemovePlayerFromRosterParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const POSITION_LABELS: Record<string, string> = {
  Setter: "Setter", OutsideHitter: "Outside Hitter",
  MiddleBlocker: "Middle Blocker", Opposite: "Opposite", Libero: "Libero/DS",
};

async function getRosterDetail(rosterId: number) {
  const [roster] = await db.select().from(rostersTable).where(eq(rostersTable.id, rosterId));
  if (!roster) return null;

  const rosterPlayers = await db.select().from(rosterPlayersTable).where(eq(rosterPlayersTable.rosterId, rosterId));
  const playerIds = rosterPlayers.map((rp) => rp.playerId);
  const players = playerIds.length > 0 ? await db.select().from(playersTable) : [];

  const playerMap: Record<number, typeof players[0]> = {};
  players.forEach((p) => { playerMap[p.id] = p; });

  const slots = rosterPlayers.map((rp) => ({
    playerId: rp.playerId,
    position: rp.position,
    locked: rp.locked,
    player: playerMap[rp.playerId],
  }));

  const positionCounts: Record<string, number> = {
    Setter: roster.setterSlots, OutsideHitter: roster.outsideHitterSlots,
    MiddleBlocker: roster.middleBlockerSlots, Opposite: roster.oppositeSlots, Libero: roster.liberoSlots,
  };

  const filledCounts: Record<string, number> = {};
  slots.forEach((s) => { filledCounts[s.position] = (filledCounts[s.position] || 0) + 1; });

  const missingPositions: string[] = [];
  Object.entries(positionCounts).forEach(([pos, needed]) => {
    const filled = filledCounts[pos] || 0;
    for (let i = 0; i < needed - filled; i++) missingPositions.push(pos);
  });

  const allPlayers = await db.select().from(playersTable).orderBy(playersTable.overallScore);
  const rosterPlayerIdSet = new Set(playerIds);
  const bubblePlayers = allPlayers
    .filter((p) => !rosterPlayerIdSet.has(p.id) && p.overallScore != null)
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
    .slice(0, 5);

  return { ...roster, players: slots, bubblePlayers, missingPositions };
}

router.get("/rosters", async (_req, res): Promise<void> => {
  const rosters = await db.select().from(rostersTable).orderBy(rostersTable.createdAt);
  res.json(rosters);
});

router.post("/rosters", async (req, res): Promise<void> => {
  const parsed = CreateRosterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [roster] = await db.insert(rostersTable).values(parsed.data).returning();
  res.status(201).json(roster);
});

router.get("/rosters/suggest", async (_req, res): Promise<void> => {
  const ROSTER_CONFIG: Record<string, number> = {
    Setter: 2, OutsideHitter: 3, MiddleBlocker: 3, Opposite: 2, Libero: 2,
  };

  const players = await db.select().from(playersTable);
  const allEvals = await db.select().from(evaluationsTable);

  const evalsByPlayer: Record<number, typeof allEvals> = {};
  allEvals.forEach((e) => {
    if (!evalsByPlayer[e.playerId]) evalsByPlayer[e.playerId] = [];
    evalsByPlayer[e.playerId].push(e);
  });

  const slots: {
    playerId: number;
    position: string;
    locked: boolean;
    player: typeof players[0];
    selectionReason: string;
  }[] = [];
  const usedIds = new Set<number>();
  const missingPositions: string[] = [];

  for (const [position, count] of Object.entries(ROSTER_CONFIG)) {
    const eligible = players
      .filter((p) => p.position === position && !usedIds.has(p.id))
      .sort((a, b) => (b.positionScore ?? b.overallScore ?? 0) - (a.positionScore ?? a.overallScore ?? 0));

    for (let i = 0; i < count; i++) {
      const p = eligible[i];
      if (!p) { missingPositions.push(position); continue; }

      // Build selection reason
      const flags = (p.flags as string[] | null) ?? [];
      const posLabel = POSITION_LABELS[position];
      const scoreStr = p.positionScore != null ? `position score ${p.positionScore}/10` : `overall score ${p.overallScore ?? "unscored"}/10`;
      let reason = `Top ${posLabel} — ${scoreStr}`;
      if (flags.includes("Roster Lock Candidate")) reason += " · Strong lock candidate";
      if (flags.includes("Consistent Performer")) reason += " · Consistent performer";
      if (flags.includes("High Potential")) reason += " · High upside";
      if (p.confidenceScore != null && p.confidenceScore >= 8) reason += " · High data confidence";

      slots.push({ playerId: p.id, position, locked: false, player: p, selectionReason: reason });
      usedIds.add(p.id);
    }
  }

  // Bubble players: within 5% of the weakest selected player per position
  const weakestByPosition: Record<string, number> = {};
  slots.forEach((s) => {
    const score = s.player.positionScore ?? s.player.overallScore ?? 0;
    if (weakestByPosition[s.position] == null || score < weakestByPosition[s.position]) {
      weakestByPosition[s.position] = score;
    }
  });

  const bubblePlayers = players
    .filter((p) => !usedIds.has(p.id) && p.overallScore != null)
    .filter((p) => {
      const threshold = (weakestByPosition[p.position] ?? 0) * 0.95;
      const score = p.positionScore ?? p.overallScore ?? 0;
      return score >= threshold;
    })
    .sort((a, b) => (b.positionScore ?? b.overallScore ?? 0) - (a.positionScore ?? a.overallScore ?? 0))
    .slice(0, 6);

  // Build explanation
  const positionSummaries = Object.entries(ROSTER_CONFIG)
    .map(([pos, n]) => {
      const filled = slots.filter((s) => s.position === pos).length;
      return filled < n ? `${POSITION_LABELS[pos]} (${filled}/${n})` : null;
    })
    .filter(Boolean);

  const explanation = positionSummaries.length > 0
    ? `Roster is missing players at: ${positionSummaries.join(", ")}. ${bubblePlayers.length} bubble players are close to the cut line. Add more athletes at missing positions or lower score thresholds.`
    : `All 12 roster spots filled. Players selected by position score (40%) + overall skill (40%) + athleticism (20%). ${bubblePlayers.length} bubble player${bubblePlayers.length !== 1 ? "s" : ""} within 5% of the final cut — coaches should review them closely before locking the roster.`;

  res.json({ players: slots, explanation, bubblePlayers, missingPositions });
});

router.get("/rosters/:id", async (req, res): Promise<void> => {
  const params = GetRosterParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const detail = await getRosterDetail(params.data.id);
  if (!detail) { res.status(404).json({ error: "Roster not found" }); return; }
  res.json(detail);
});

router.patch("/rosters/:id", async (req, res): Promise<void> => {
  const params = UpdateRosterParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateRosterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [roster] = await db.update(rostersTable).set(parsed.data).where(eq(rostersTable.id, params.data.id)).returning();
  if (!roster) { res.status(404).json({ error: "Roster not found" }); return; }
  res.json(roster);
});

router.post("/rosters/:id/players", async (req, res): Promise<void> => {
  const params = AddPlayerToRosterParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = AddPlayerToRosterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [roster] = await db.select().from(rostersTable).where(eq(rostersTable.id, params.data.id));
  if (!roster) { res.status(404).json({ error: "Roster not found" }); return; }

  await db.insert(rosterPlayersTable).values({
    rosterId: params.data.id,
    playerId: parsed.data.playerId,
    position: parsed.data.position,
    locked: parsed.data.locked ?? false,
  });

  const detail = await getRosterDetail(params.data.id);
  res.status(201).json(detail);
});

router.delete("/rosters/:id/players/:playerId", async (req, res): Promise<void> => {
  const params = RemovePlayerFromRosterParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(rosterPlayersTable).where(
    and(eq(rosterPlayersTable.rosterId, params.data.id), eq(rosterPlayersTable.playerId, params.data.playerId))
  );

  res.sendStatus(204);
});

export default router;
