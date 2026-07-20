import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { broadcast } from "../events";

// Store in memory — photos are saved as base64 data URLs in the DB (no filesystem needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});


const router: IRouter = Router();

router.post("/players/:id/photo", upload.single("photo"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const clubId = req.clubId;
  const photoUrl = `data:image/jpeg;base64,${req.file.buffer.toString("base64")}`;

  await db.update(playersTable).set({ photoUrl }).where(and(eq(playersTable.id, id), eq(playersTable.clubId, clubId)));
  broadcast("players:changed", req.clubId);
  res.json({ ok: true, photoUrl });
});

router.delete("/players/:id/photo", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const clubId = req.clubId;
  await db.update(playersTable).set({ photoUrl: null }).where(and(eq(playersTable.id, id), eq(playersTable.clubId, clubId)));
  broadcast("players:changed", req.clubId);
  res.status(204).send();
});

export default router;
