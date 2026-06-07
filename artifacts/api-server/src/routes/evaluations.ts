import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, evaluationsTable } from "@workspace/db";
import {
  ListEvaluationsQueryParams,
  UpsertEvaluationBody,
  UpdateEvaluationParams,
  UpdateEvaluationBody,
} from "@workspace/api-zod";
import { recomputeAllScores } from "../scoring";
import { broadcast } from "../events";

const router: IRouter = Router();

router.get("/evaluations", async (req, res): Promise<void> => {
  const params = ListEvaluationsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const evals = params.data.playerId
    ? await db.select().from(evaluationsTable).where(eq(evaluationsTable.playerId, params.data.playerId))
    : await db.select().from(evaluationsTable);

  res.json(evals);
});

router.post("/evaluations", async (req, res): Promise<void> => {
  const parsed = UpsertEvaluationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const coachName = parsed.data.coachName ?? null;
  const coachFilter = coachName
    ? eq(evaluationsTable.coachName, coachName)
    : isNull(evaluationsTable.coachName);

  const existing = await db
    .select()
    .from(evaluationsTable)
    .where(
      and(
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
      .where(eq(evaluationsTable.id, existing[0].id))
      .returning();
    evalResult = updated;
  } else {
    const [created] = await db
      .insert(evaluationsTable)
      .values({
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

  // Recompute scores across all players (physical score is percentile-based — needs full pool)
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

  const existing = await db.select().from(evaluationsTable).where(eq(evaluationsTable.id, params.data.id));
  if (existing.length === 0) {
    res.status(404).json({ error: "Evaluation not found" });
    return;
  }

  const [updated] = await db
    .update(evaluationsTable)
    .set(parsed.data)
    .where(eq(evaluationsTable.id, params.data.id))
    .returning();

  await recomputeAllScores();

  res.json(updated);
});

// Specific route must come before the generic /:id route
// coachName param "__null__" means IS NULL (evaluations submitted without a coach)
router.delete("/evaluations/coach/:playerId/:coachName", async (req, res): Promise<void> => {
  const playerId = parseInt(req.params.playerId);
  const coachName = req.params.coachName;
  if (isNaN(playerId)) { res.status(400).json({ error: "Invalid playerId" }); return; }

  const coachFilter = coachName === "__null__"
    ? isNull(evaluationsTable.coachName)
    : eq(evaluationsTable.coachName, coachName);

  await db.delete(evaluationsTable).where(
    and(eq(evaluationsTable.playerId, playerId), coachFilter)
  );
  await recomputeAllScores();
  broadcast("scores:changed");
  res.status(204).send();
});

router.delete("/evaluations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const existing = await db.select().from(evaluationsTable).where(eq(evaluationsTable.id, id));
  if (existing.length === 0) { res.status(404).json({ error: "Evaluation not found" }); return; }

  await db.delete(evaluationsTable).where(eq(evaluationsTable.id, id));
  await recomputeAllScores();
  broadcast("scores:changed");
  res.status(204).send();
});

export default router;
