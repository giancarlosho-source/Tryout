import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, clubsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function jwtSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (!s) throw new Error("JWT_SECRET env var is not set");
  return s;
}

// POST /api/auth/signup — first-time club setup (only works if no club exists yet)
router.post("/auth/signup", async (req, res): Promise<void> => {
  try {
    const existing = await db.select().from(clubsTable).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Club account already exists. Please log in." });
      return;
    }

    const { name, email, password } = req.body ?? {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email, and password are required." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [club] = await db.insert(clubsTable).values({ name, email: email.toLowerCase(), passwordHash }).returning();
    const token = jwt.sign({ clubId: club.id, email: club.email }, jwtSecret(), { expiresIn: "30d" });
    res.json({ token, club: { id: club.id, name: club.name, email: club.email } });
  } catch {
    res.status(500).json({ error: "Server error during signup." });
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required." });
      return;
    }

    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.email, email.toLowerCase()));
    if (!club) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const match = await bcrypt.compare(password, club.passwordHash);
    if (!match) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = jwt.sign({ clubId: club.id, email: club.email }, jwtSecret(), { expiresIn: "30d" });
    res.json({ token, club: { id: club.id, name: club.name, email: club.email } });
  } catch {
    res.status(500).json({ error: "Server error during login." });
  }
});

// GET /api/auth/me — verify token and return club info
router.get("/auth/me", async (req, res): Promise<void> => {
  try {
    const header = req.headers["authorization"];
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided." });
      return;
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, jwtSecret()) as { clubId: number };
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, payload.clubId));
    if (!club) {
      res.status(401).json({ error: "Club not found." });
      return;
    }
    res.json({ club: { id: club.id, name: club.name, email: club.email } });
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
});

// GET /api/auth/status — tells the dashboard whether signup is needed or login is needed
router.get("/auth/status", async (_req, res): Promise<void> => {
  const existing = await db.select().from(clubsTable).limit(1);
  res.json({ hasClub: existing.length > 0 });
});

export default router;
