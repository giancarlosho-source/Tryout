import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, coachNotesTable } from "@workspace/db";
import {
  ListNotesQueryParams,
  CreateNoteBody,
  UpdateNoteParams,
  UpdateNoteBody,
  DeleteNoteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notes", async (req, res): Promise<void> => {
  const params = ListNotesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let notes;
  if (params.data.playerId) {
    notes = await db
      .select()
      .from(coachNotesTable)
      .where(eq(coachNotesTable.playerId, params.data.playerId))
      .orderBy(coachNotesTable.createdAt);
  } else {
    notes = await db.select().from(coachNotesTable).orderBy(coachNotesTable.createdAt);
  }

  res.json(notes);
});

router.post("/notes", async (req, res): Promise<void> => {
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [note] = await db.insert(coachNotesTable).values(parsed.data).returning();
  res.status(201).json(note);
});

router.patch("/notes/:id", async (req, res): Promise<void> => {
  const params = UpdateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [note] = await db
    .update(coachNotesTable)
    .set(parsed.data)
    .where(eq(coachNotesTable.id, params.data.id))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(note);
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [note] = await db
    .delete(coachNotesTable)
    .where(eq(coachNotesTable.id, params.data.id))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
