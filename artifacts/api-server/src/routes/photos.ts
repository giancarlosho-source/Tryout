import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { broadcast } from "../events";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, _file, cb) => {
    const id = req.params.id;
    cb(null, `player-${id}-${Date.now()}.jpg`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const router: IRouter = Router();

router.post("/players/:id/photo", upload.single("photo"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const photoUrl = `/uploads/${req.file.filename}`;

  // Delete old photo if one exists
  const [existing] = await db.select({ photoUrl: playersTable.photoUrl }).from(playersTable).where(eq(playersTable.id, id));
  if (existing?.photoUrl) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(existing.photoUrl));
    fs.unlink(oldPath, () => {});
  }

  await db.update(playersTable).set({ photoUrl }).where(eq(playersTable.id, id));
  broadcast("players:changed");
  res.json({ ok: true, photoUrl });
});

router.delete("/players/:id/photo", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select({ photoUrl: playersTable.photoUrl }).from(playersTable).where(eq(playersTable.id, id));
  if (existing?.photoUrl) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(existing.photoUrl));
    fs.unlink(oldPath, () => {});
  }

  await db.update(playersTable).set({ photoUrl: null }).where(eq(playersTable.id, id));
  broadcast("players:changed");
  res.status(204).send();
});

export default router;
export { UPLOADS_DIR };
