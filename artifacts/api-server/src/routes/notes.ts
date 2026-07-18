import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, coachNotesTable } from "@workspace/db";
import { broadcast } from "../events";
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

  const clubId = req.clubId;
  let notes;
  if (params.data.playerId) {
    notes = await db
      .select()
      .from(coachNotesTable)
      .where(and(eq(coachNotesTable.clubId, clubId), eq(coachNotesTable.playerId, params.data.playerId)))
      .orderBy(coachNotesTable.createdAt);
  } else {
    notes = await db.select().from(coachNotesTable).where(eq(coachNotesTable.clubId, clubId)).orderBy(coachNotesTable.createdAt);
  }

  res.json(notes);
});

router.post("/notes", async (req, res): Promise<void> => {
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const clubId = req.clubId;
  const [note] = await db.insert(coachNotesTable).values({ ...parsed.data, clubId }).returning();
  broadcast("players:changed");
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

  const clubId = req.clubId;
  const [note] = await db
    .update(coachNotesTable)
    .set(parsed.data)
    .where(and(eq(coachNotesTable.id, params.data.id), eq(coachNotesTable.clubId, clubId)))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  broadcast("players:changed");
  res.json(note);
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const clubId = req.clubId;
  const [note] = await db
    .delete(coachNotesTable)
    .where(and(eq(coachNotesTable.id, params.data.id), eq(coachNotesTable.clubId, clubId)))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  broadcast("players:changed");
  res.sendStatus(204);
});

export default router;
