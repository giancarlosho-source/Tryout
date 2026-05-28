import { eq } from "drizzle-orm";
import { db, playersTable, evaluationsTable } from "@workspace/db";

// ============================================================
// WEIGHT CONFIGURATION — change weights here, nowhere else
// ============================================================

export const UNIVERSAL_WEIGHTS: Record<string, number> = {
  "Volleyball IQ": 0.15,
  "Coachability": 0.15,
  "Consistency": 0.15,
  "Passing": 0.15,
  "Serving": 0.10,
  "Defense": 0.10,
  "Communication": 0.10,
  "Competitiveness": 0.10,
};

export const POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  Setter: {
    "Decision-making": 0.25,
    "Hands": 0.20,
    "Location": 0.20,
    "Tempo": 0.15,
    "Leadership": 0.10,
    "Volleyball IQ": 0.10,
  },
  OutsideHitter: {
    "Serve receive": 0.25,
    "Attacking": 0.25,
    "Defense": 0.15,
    "Transition": 0.15,
    "Serving": 0.10,
    "All-around value": 0.10,
  },
  MiddleBlocker: {
    "Blocking": 0.30,
    "Lateral movement": 0.20,
    "Quick attack": 0.20,
    "Footwork": 0.15,
    "Court awareness": 0.15,
  },
  Opposite: {
    "Attacking": 0.30,
    "Blocking": 0.25,
    "Physical upside": 0.20,
    "Serving": 0.15,
    "Back-row value": 0.10,
  },
  Libero: {
    "Passing": 0.30,
    "Defense": 0.25,
    "Reading hitters": 0.20,
    "Serve receive": 0.15,
    "Communication": 0.10,
  },
};

export const POSITION_SKILL_LIST: Record<string, string[]> = {
  Setter: ["Hands", "Location", "Decision-making", "Tempo", "Leadership"],
  OutsideHitter: ["Serve receive", "Attacking", "Defense", "Transition", "All-around value"],
  MiddleBlocker: ["Blocking", "Lateral movement", "Quick attack", "Footwork", "Court awareness"],
  Opposite: ["Attacking", "Blocking", "Serving", "Back-row value", "Physical upside"],
  Libero: ["Passing", "Defense", "Reading hitters", "Serve receive", "Communication"],
};

export const OVERALL_WEIGHTS = { universal: 0.40, position: 0.40, physical: 0.20 };
export const POTENTIAL_WEIGHTS = { physical: 0.45, coachability: 0.20, competitiveness: 0.15, volleyballIQ: 0.10, bonus: 0.10 };

// ============================================================
// PURE MATH HELPERS
// ============================================================

function r1(n: number): number { return Math.round(n * 10) / 10; }
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }

function percentileRank(value: number, pool: number[]): number {
  if (pool.length <= 1) return 0.5;
  const below = pool.filter((v) => v < value).length;
  const equal = pool.filter((v) => v === value).length;
  return (below + equal * 0.5) / pool.length;
}

// ============================================================
// SCORE COMPUTATION (pure functions — no DB access)
// ============================================================

export function computePhysicalScore(
  player: { heightInches?: number | null; standingReachInches?: number | null; verticalJumpInches?: number | null },
  allPlayers: { heightInches?: number | null; standingReachInches?: number | null; verticalJumpInches?: number | null }[]
): number | null {
  const heights = allPlayers.map((p) => p.heightInches).filter((v): v is number => v != null);
  const reaches = allPlayers.map((p) => p.standingReachInches).filter((v): v is number => v != null);
  const verticals = allPlayers.map((p) => p.verticalJumpInches).filter((v): v is number => v != null);

  let sum = 0, weight = 0;
  if (player.heightInches != null && heights.length > 0) {
    sum += percentileRank(player.heightInches, heights) * 10 * 0.40;
    weight += 0.40;
  }
  if (player.standingReachInches != null && reaches.length > 0) {
    sum += percentileRank(player.standingReachInches, reaches) * 10 * 0.30;
    weight += 0.30;
  }
  if (player.verticalJumpInches != null && verticals.length > 0) {
    sum += percentileRank(player.verticalJumpInches, verticals) * 10 * 0.30;
    weight += 0.30;
  }
  if (weight === 0) return null;
  return r1(clamp(sum / weight, 0, 10));
}

export function computeUniversalScore(evals: { skill: string; score: number }[]): number | null {
  const map: Record<string, number> = {};
  evals.forEach((e) => { map[e.skill] = e.score; });

  let sum = 0, weight = 0;
  for (const [skill, w] of Object.entries(UNIVERSAL_WEIGHTS)) {
    if (map[skill] != null) { sum += map[skill] * w; weight += w; }
  }
  return weight === 0 ? null : r1(clamp(sum / weight, 1, 10));
}

export function computePositionScore(evals: { skill: string; score: number }[], position: string): number | null {
  const weights = POSITION_WEIGHTS[position];
  if (!weights) return null;

  const map: Record<string, number> = {};
  evals.forEach((e) => { map[e.skill] = e.score; });

  let sum = 0, weight = 0;
  for (const [skill, w] of Object.entries(weights)) {
    if (map[skill] != null) { sum += map[skill] * w; weight += w; }
  }
  return weight === 0 ? null : r1(clamp(sum / weight, 1, 10));
}

export function computeOverallScore(
  universalScore: number | null,
  positionScore: number | null,
  physicalScore: number | null
): number | null {
  let sum = 0, weight = 0;
  if (universalScore != null) { sum += universalScore * OVERALL_WEIGHTS.universal; weight += OVERALL_WEIGHTS.universal; }
  if (positionScore != null) { sum += positionScore * OVERALL_WEIGHTS.position; weight += OVERALL_WEIGHTS.position; }
  if (physicalScore != null) { sum += physicalScore * OVERALL_WEIGHTS.physical; weight += OVERALL_WEIGHTS.physical; }
  return weight === 0 ? null : r1(clamp(sum / weight, 1, 10));
}

export function computePotentialScore(
  physicalScore: number | null,
  positionScore: number | null,
  evals: { skill: string; score: number }[]
): number | null {
  const map: Record<string, number> = {};
  evals.forEach((e) => { map[e.skill] = e.score; });

  let sum = 0, weight = 0;
  if (physicalScore != null) { sum += physicalScore * POTENTIAL_WEIGHTS.physical; weight += POTENTIAL_WEIGHTS.physical; }
  if (map["Coachability"] != null) { sum += map["Coachability"] * POTENTIAL_WEIGHTS.coachability; weight += POTENTIAL_WEIGHTS.coachability; }
  if (map["Competitiveness"] != null) { sum += map["Competitiveness"] * POTENTIAL_WEIGHTS.competitiveness; weight += POTENTIAL_WEIGHTS.competitiveness; }
  if (map["Volleyball IQ"] != null) { sum += map["Volleyball IQ"] * POTENTIAL_WEIGHTS.volleyballIQ; weight += POTENTIAL_WEIGHTS.volleyballIQ; }

  // Raw Athletic Upside Bonus: high physical + low position skill = untapped potential
  if (physicalScore != null && positionScore != null && physicalScore >= 7.0 && positionScore < 6.5) {
    const bonus = physicalScore >= 8.0 ? 8.5 : 7.5; // controlled bonus value
    sum += bonus * POTENTIAL_WEIGHTS.bonus;
    weight += POTENTIAL_WEIGHTS.bonus;
  }

  return weight === 0 ? null : r1(clamp(sum / weight, 1, 10));
}

export function computeConfidenceScore(
  player: { heightInches?: number | null; standingReachInches?: number | null; verticalJumpInches?: number | null },
  evals: { skill: string; score: number }[],
  position: string
): number {
  const totalSkills = Object.keys(UNIVERSAL_WEIGHTS).length + (POSITION_SKILL_LIST[position]?.length ?? 0);
  const presentSkills = new Set(evals.map((e) => e.skill)).size;
  const skillCoverage = Math.min(1, presentSkills / totalSkills);

  const measurementsPresent = [player.heightInches, player.standingReachInches, player.verticalJumpInches]
    .filter((v) => v != null).length;
  const measurementCoverage = measurementsPresent / 3;

  return r1(clamp(skillCoverage * 0.70 + measurementCoverage * 0.30, 0, 1) * 10);
}

export function computeFlags(
  player: { heightInches?: number | null; standingReachInches?: number | null; verticalJumpInches?: number | null; position: string },
  scores: { overallScore: number | null; positionScore: number | null; physicalScore: number | null; potentialScore: number | null; confidenceScore: number },
  evals: { skill: string; score: number }[]
): string[] {
  const flags: string[] = [];
  const { overallScore, positionScore, physicalScore, potentialScore, confidenceScore } = scores;

  if (!player.heightInches || !player.standingReachInches || !player.verticalJumpInches) {
    flags.push("Missing Measurements");
  }

  if (confidenceScore < 5.0) {
    flags.push("Needs More Evaluation");
  }

  if (potentialScore != null && overallScore != null && potentialScore >= 8.0 && potentialScore > overallScore + 1.0) {
    flags.push("High Potential");
  }

  if (physicalScore != null && positionScore != null && physicalScore >= 7.5 && positionScore < 6.5) {
    flags.push("Raw Athlete");
  }

  if (physicalScore != null && positionScore != null && positionScore >= 7.5 && physicalScore < 5.5) {
    flags.push("Skilled but Undersized");
  }

  if (evals.length >= 6) {
    const evalScores = evals.map((e) => e.score);
    const avg = evalScores.reduce((s, v) => s + v, 0) / evalScores.length;
    const variance = evalScores.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / evalScores.length;
    if (variance < 1.5 && avg >= 6.5) {
      flags.push("Consistent Performer");
    }
  }

  if (positionScore != null && positionScore >= 8.0 && confidenceScore >= 7.0) {
    flags.push("Roster Lock Candidate");
  }

  if (player.position !== "Libero" && player.heightInches != null && player.heightInches < 64) {
    flags.push("Position Change Candidate");
  }

  return flags;
}

// ============================================================
// DB RECOMPUTE — runs a full population pass (needed for percentile)
// ============================================================

export async function recomputeAllScores(): Promise<void> {
  const allPlayers = await db.select().from(playersTable);
  const allEvals = await db.select().from(evaluationsTable);

  const evalsByPlayer: Record<number, { skill: string; score: number }[]> = {};
  for (const e of allEvals) {
    if (!evalsByPlayer[e.playerId]) evalsByPlayer[e.playerId] = [];
    evalsByPlayer[e.playerId].push({ skill: e.skill, score: e.score });
  }

  for (const player of allPlayers) {
    const evals = evalsByPlayer[player.id] ?? [];

    const physicalScore = computePhysicalScore(player, allPlayers);
    const universalScore = computeUniversalScore(evals);
    const positionScore = computePositionScore(evals, player.position);
    const overallScore = computeOverallScore(universalScore, positionScore, physicalScore);
    const potentialScore = computePotentialScore(physicalScore, positionScore, evals);
    const confidenceScore = computeConfidenceScore(player, evals, player.position);
    const flags = computeFlags(player, { overallScore, positionScore, physicalScore, potentialScore, confidenceScore }, evals);

    await db
      .update(playersTable)
      .set({ overallScore, positionScore, potentialScore, physicalScore, confidenceScore, flags })
      .where(eq(playersTable.id, player.id));
  }
}
