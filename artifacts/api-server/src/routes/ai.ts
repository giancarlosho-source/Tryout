import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, playersTable, evaluationsTable, rosterPlayersTable, rostersTable } from "@workspace/db";
import {
  GeneratePlayerSummaryParams,
  GenerateRosterExplanationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();


const POSITION_LABELS: Record<string, string> = {
  Setter: "Setter",
  OutsideHitter: "Outside Hitter",
  MiddleBlocker: "Middle Blocker",
  Opposite: "Opposite",
  Libero: "Libero/DS",
  Undecided: "Undecided",
};

router.post("/ai/player-summary/:playerId", async (req, res): Promise<void> => {
  const params = GeneratePlayerSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clubId = req.clubId;
  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, params.data.playerId), eq(playersTable.clubId, clubId)));

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const evals = await db
    .select()
    .from(evaluationsTable)
    .where(and(eq(evaluationsTable.playerId, params.data.playerId), eq(evaluationsTable.clubId, clubId)));

  const posLabel = (player.position && POSITION_LABELS[player.position]) || player.position || "Unknown";

  const topSkills = [...evals].sort((a, b) => b.score - a.score).slice(0, 3);
  const weakSkills = [...evals].sort((a, b) => a.score - b.score).slice(0, 3);

  const strengths = topSkills.map((e) => `${e.skill} (${e.score}/10)`);
  const weaknesses = weakSkills
    .filter((e) => e.score < 7)
    .map((e) => `${e.skill} (${e.score}/10)`);

  const risks: string[] = [];
  const overall = player.overallScore ?? 0;
  const potential = player.potentialScore ?? 0;
  const athleticSkills = ["Competitiveness", "Coachability"];
  const techSkills = ["Serving", "Passing", "Defense", "Volleyball IQ"];

  const avgAthleticism = evals
    .filter((e) => athleticSkills.includes(e.skill))
    .reduce((s, e, _, arr) => s + e.score / arr.length, 0);
  const avgTechnique = evals
    .filter((e) => techSkills.includes(e.skill))
    .reduce((s, e, _, arr) => s + e.score / arr.length, 0);

  if (avgAthleticism > 7.5 && avgTechnique < 6) {
    risks.push("High athleticism, low technique — needs skill development");
  }
  if (player.heightInches && player.heightInches < 65 && player.position !== "Libero") {
    risks.push("Height may limit impact at this position");
  }
  if (potential > overall + 1.5) {
    risks.push("Raw upside present but consistency is a question mark");
  }

  const positionFit =
    overall >= 7
      ? `Strong fit for ${posLabel}`
      : overall >= 5
      ? `Developing ${posLabel} — needs work in key areas`
      : `Below average for ${posLabel} at this level`;

  const potentialNote =
    potential >= 8
      ? "High potential — one of the top developmental players in the pool"
      : potential >= 6
      ? "Moderate upside — with coaching investment could grow significantly"
      : "Limited physical upside at this stage";

  const suggestedPositionChange =
    player.position !== "Libero" &&
    player.heightInches != null &&
    player.heightInches < 64
      ? "Libero"
      : null;

  const summary = `${player.name} (#{${player.jerseyNumber}}) is a ${posLabel} with ${
    evals.length > 0 ? `an overall score of ${overall}/10` : "no evaluations yet"
  }. ${
    strengths.length > 0
      ? `Strongest skills: ${strengths.slice(0, 2).join(", ")}.`
      : ""
  } ${
    weaknesses.length > 0
      ? `Areas needing development: ${weaknesses.slice(0, 2).join(", ")}.`
      : ""
  } ${potentialNote}.`;

  res.json({
    playerId: params.data.playerId,
    summary,
    strengths,
    weaknesses,
    risks,
    positionFit,
    potentialNote,
    suggestedPositionChange,
  });
});

router.post("/ai/roster-explain/:rosterId", async (req, res): Promise<void> => {
  const params = GenerateRosterExplanationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clubId = req.clubId;
  const [roster] = await db
    .select()
    .from(rostersTable)
    .where(and(eq(rostersTable.id, params.data.rosterId), eq(rostersTable.clubId, clubId)));

  if (!roster) {
    res.status(404).json({ error: "Roster not found" });
    return;
  }

  const rosterPlayers = await db
    .select()
    .from(rosterPlayersTable)
    .where(eq(rosterPlayersTable.rosterId, params.data.rosterId));

  const playerIds = rosterPlayers.map((rp) => rp.playerId);
  const allPlayers = await db.select().from(playersTable).where(eq(playersTable.clubId, clubId));
  const playerMap: Record<number, typeof allPlayers[0]> = {};
  allPlayers.forEach((p) => {
    playerMap[p.id] = p;
  });

  const rosterPlayerIdSet = new Set(playerIds);

  const playerDecisions = [
    ...rosterPlayers.map((rp) => {
      const p = playerMap[rp.playerId];
      return {
        playerId: rp.playerId,
        playerName: p?.name ?? `Player #${rp.playerId}`,
        decision: "selected" as const,
        reason: `Selected as ${POSITION_LABELS[rp.position] || rp.position} with overall score ${
          p?.overallScore != null ? `${p.overallScore}/10` : "unscored"
        }`,
      };
    }),
    ...allPlayers
      .filter((p) => !rosterPlayerIdSet.has(p.id) && p.overallScore != null)
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0))
      .slice(0, 3)
      .map((p) => ({
        playerId: p.id,
        playerName: p.name,
        decision: "bubble" as const,
        reason: `Narrowly missed the roster — overall ${p.overallScore}/10 as ${
          (p.position && POSITION_LABELS[p.position]) || p.position || "Unknown"
        }`,
      })),
  ];

  const selectedCount = rosterPlayers.length;
  const explanation = `Roster "${roster.name}" contains ${selectedCount} of 12 target players. Players were selected by position score and overall athleticism. ${
    selectedCount < 12
      ? `${12 - selectedCount} roster spot(s) remain open.`
      : "All 12 spots are filled."
  } Coaches should review bubble players closely before finalizing.`;

  res.json({
    rosterId: params.data.rosterId,
    explanation,
    playerDecisions,
  });
});

export default router;
