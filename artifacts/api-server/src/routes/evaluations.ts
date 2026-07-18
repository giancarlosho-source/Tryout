import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, evaluationsTable } from "@workspace/db";
import jwt from "jsonwebtoken";
import {
  ListEvaluationsQueryParams,
  UpsertEvaluationBody,
  UpdateEvaluationParams,
  UpdateEvaluationBody,
} from "@workspace/api-zod";
import { recomputeAllScores } from "../scoring";
import { broadcast } from "../events";

const router: IRouter = Router();

function getClubId(req: { headers: { authorization?: string } }): number {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) throw new Error("No token");
  const payload = jwt.verify(header.slice(7), process.env["JWT_SECRET"]!) as { clubId: number };
  return payload.clubId;
}

router.get("/evaluations", async (req, res): Promise<void> => {
  const params = ListEvaluationsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clubId = getClubId(req);
  const evals = params.data.playerId
    ? await db.select().from(evaluationsTable).where(and(eq(evaluationsTable.clubId, clubId), eq(evaluationsTable.playerId, params.data.playerId)))
    : await db.select().from(evaluationsTable).where(eq(evaluationsTable.clubId, clubId));

  res.json(evals);
});

router.post("/evaluations", async (req, res): Promise<void> => {
  const parsed = UpsertEvaluationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const clubId = getClubId(req);
  const coachName = parsed.data.coachName ?? null;
  const coachFilter = coachName
    ? eq(evaluationsTable.coachName, coachName)
    : isNull(evaluationsTable.coachName);

  const existing = await db
    .select()
    .from(evaluationsTable)
    .where(
      and(
        eq(evaluationsTable.clubId, clubId),
        eq(evaluationsTable.playerId, parsed.data.playerId),
        eq(evaluationsTable.category, parsed.data.category),
        eq(evaluationsTable.skill, parsed.data.skill),
        coachFilter
      )
    );

  let evalResult;
  if (existing.length > 0) {
    const [updated] = await db
      .update(evaluationsTable)
      .set({ score: parsed.data.score, notes: parsed.data.notes ?? null })
      .where(and(eq(evaluationsTable.id, existing[0].id), eq(evaluationsTable.clubId, clubId)))
      .returning();
    evalResult = updated;
  } else {
    const [created] = await db
      .insert(evaluationsTable)
      .values({
        clubId,
        playerId: parsed.data.playerId,
        category: parsed.data.category,
        skill: parsed.data.skill,
        score: parsed.data.score,
        notes: parsed.data.notes ?? null,
        coachName,
      })
      .returning();
    evalResult = created;
  }

  await recomputeAllScores();
  broadcast("scores:changed");

  res.json(evalResult);
});

router.patch("/evaluations/:id", async (req, res): Promise<void> => {
  const params = UpdateEvaluationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEvaluationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const clubId = getClubId(req);
  const existing = await db.select().from(evaluationsTable).where(and(eq(evaluationsTable.id, params.data.id), eq(evaluationsTable.clubId, clubId)));
  if (existing.length === 0) {
    res.status(404).json({ error: "Evaluation not found" });
    return;
  }

  const [updated] = await db
    .update(evaluationsTable)
    .set(parsed.data)
    .where(and(eq(evaluationsTable.id, params.data.id), eq(evaluationsTable.clubId, clubId)))
    .returning();

  await recomputeAllScores();
  broadcast("scores:changed");

  res.json(updated);
});

// coachName param "__null__" means IS NULL
router.delete("/evaluations/coach/:playerId/:coachName", async (req, res): Promise<void> => {
  const playerId = parseInt(req.params.playerId);
  const coachName = req.params.coachName;
  if (isNaN(playerId)) { res.status(400).json({ error: "Invalid playerId" }); return; }

  const clubId = getClubId(req);
  const coachFilter = coachName === "__null__"
    ? isNull(evaluationsTable.coachName)
    : eq(evaluationsTable.coachName, coachName);

  await db.delete(evaluationsTable).where(
    and(eq(evaluationsTable.clubId, clubId), eq(evaluationsTable.playerId, playerId), coachFilter)
  );
  await recomputeAllScores();
  broadcast("scores:changed");
  res.status(204).send();
});

router.delete("/evaluations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const clubId = getClubId(req);
  const existing = await db.select().from(evaluationsTable).where(and(eq(evaluationsTable.id, id), eq(evaluationsTable.clubId, clubId)));
  if (existing.length === 0) { res.status(404).json({ error: "Evaluation not found" }); return; }

  await db.delete(evaluationsTable).where(and(eq(evaluationsTable.id, id), eq(evaluationsTable.clubId, clubId)));
  await recomputeAllScores();
  broadcast("scores:changed");
  res.status(204).send();
});

export default router;
