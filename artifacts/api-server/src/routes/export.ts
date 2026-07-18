import { Router, type IRouter } from "express";
import { db, playersTable, evaluationsTable } from "@workspace/db";
import { asc, eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

function getClubId(req: { headers: { authorization?: string } }): number {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) throw new Error("No token");
  const payload = jwt.verify(header.slice(7), process.env["JWT_SECRET"]!) as { clubId: number };
  return payload.clubId;
}

router.get("/export/players", async (req, res): Promise<void> => {
  const clubId = getClubId(req);
  const players = await db.select().from(playersTable).where(eq(playersTable.clubId, clubId)).orderBy(asc(playersTable.jerseyNumber));

  const headers = [
    "Jersey", "Name", "Position", "Checked In",
    "Height (in)", "Reach (in)", "Vertical (in)",
    "Overall", "Position Score", "Potential", "Physical",
    "Confidence", "Flags",
  ];

  const escape = (v: string | number | boolean | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = players.map((p) => [
    escape(p.jerseyNumber),
    escape(p.name),
    escape(p.position),
    escape(p.checkedIn ? "Yes" : "No"),
    escape(p.heightInches),
    escape(p.standingReachInches),
    escape(p.verticalJumpInches),
    escape(p.overallScore != null ? p.overallScore.toFixed(1) : ""),
    escape(p.positionScore != null ? p.positionScore.toFixed(1) : ""),
    escape(p.potentialScore != null ? p.potentialScore.toFixed(1) : ""),
    escape(p.physicalScore != null ? p.physicalScore.toFixed(1) : ""),
    escape(p.confidenceScore != null ? p.confidenceScore.toFixed(1) : ""),
    escape((p.flags ?? []).join("; ")),
  ]);

  const csv = [headers.map(escape), ...rows].map((row) => row.join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="players-${date}.csv"`);
  res.send(csv);
});

router.get("/export/evaluations", async (req, res): Promise<void> => {
  const clubId = getClubId(req);
  const players = await db.select().from(playersTable).where(eq(playersTable.clubId, clubId)).orderBy(asc(playersTable.jerseyNumber));
  const evals = await db.select().from(evaluationsTable).where(eq(evaluationsTable.clubId, clubId));

  const playerMap = new Map(players.map((p) => [p.id, p]));

  const headers = ["Jersey", "Name", "Position", "Coach", "Category", "Skill", "Score"];
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = evals.map((e) => {
    const p = playerMap.get(e.playerId);
    return [
      escape(p?.jerseyNumber),
      escape(p?.name),
      escape(p?.position),
      escape(e.coachName ?? ""),
      escape(e.category),
      escape(e.skill),
      escape(e.score),
    ];
  });

  const csv = [headers.map(escape), ...rows].map((row) => row.join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="evaluations-${date}.csv"`);
  res.send(csv);
});

export default router;
