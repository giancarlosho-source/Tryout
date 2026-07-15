import { Router, type IRouter, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db, clubsTable, playersTable, coachesTable, evaluationsTable, coachNotesTable, rostersTable, staffTable, settingsTable, syncLogsTable, clubUsersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

function jwtSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (!s) throw new Error("JWT_SECRET not set");
  return s;
}

function getSuperAdminEmails(): Set<string> {
  return new Set(
    (process.env["SUPER_ADMIN_EMAIL"] ?? "")
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function requireSuperAdmin(req: Request, res: Response): boolean {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return false;
  }
  const payload = jwt.verify(header.slice(7), jwtSecret()) as { superAdmin?: boolean };
  if (!payload.superAdmin) {
    res.status(403).json({ error: "Access denied." });
    return false;
  }
  return true;
}

// POST /api/auth/admin-login — super admin login (no club required)
router.post("/auth/admin-login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required." });
      return;
    }
    if (!getSuperAdminEmails().has(email.trim().toLowerCase())) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }
    const adminPassword = process.env["SUPER_ADMIN_PASSWORD"];
    if (!adminPassword) {
      res.status(500).json({ error: "Admin password not configured." });
      return;
    }
    const valid = await bcrypt.compare(password, adminPassword);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }
    const token = jwt.sign({ superAdmin: true, email: email.trim().toLowerCase() }, jwtSecret(), { expiresIn: "7d" });
    res.json({ token });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// GET /api/admin/clubs — list all clubs with stats
router.get("/admin/clubs", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const clubs = await db.select().from(clubsTable).orderBy(clubsTable.createdAt);

    const playerCounts = await db
      .select({ clubId: playersTable.clubId, count: sql<number>`count(*)::int` })
      .from(playersTable)
      .groupBy(playersTable.clubId);

    const coachCounts = await db
      .select({ clubId: coachesTable.clubId, count: sql<number>`count(*)::int` })
      .from(coachesTable)
      .groupBy(coachesTable.clubId);

    const evalCounts = await db
      .select({ clubId: evaluationsTable.clubId, count: sql<number>`count(*)::int` })
      .from(evaluationsTable)
      .groupBy(evaluationsTable.clubId);

    const playerMap = Object.fromEntries(playerCounts.map(r => [r.clubId, r.count]));
    const coachMap = Object.fromEntries(coachCounts.map(r => [r.clubId, r.count]));
    const evalMap = Object.fromEntries(evalCounts.map(r => [r.clubId, r.count]));

    const result = clubs.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      status: c.status,
      plan: c.plan,
      trialEndsAt: c.trialEndsAt,
      maxPlayers: c.maxPlayers,
      maxCoaches: c.maxCoaches,
      maxEvents: c.maxEvents,
      createdAt: c.createdAt,
      emailVerifiedAt: c.emailVerifiedAt,
      playerCount: playerMap[c.id] ?? 0,
      coachCount: coachMap[c.id] ?? 0,
      evalCount: evalMap[c.id] ?? 0,
    }));

    res.json({ clubs: result });
  } catch (err) {
    console.error("Admin clubs error:", err);
    res.status(500).json({ error: "Failed to fetch clubs." });
  }
});

// PUT /api/admin/clubs/:id — update status, plan, limits
router.put("/admin/clubs/:id", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const id = parseInt(req.params.id);
    const { status, plan, maxPlayers, maxCoaches, maxEvents, emailVerified } = req.body ?? {};

    const updates: Partial<typeof clubsTable.$inferInsert> = {};
    if (status) updates.status = status;
    if (plan !== undefined) updates.plan = plan || null;
    if (maxPlayers !== undefined) updates.maxPlayers = maxPlayers || null;
    if (maxCoaches !== undefined) updates.maxCoaches = maxCoaches || null;
    if (maxEvents !== undefined) updates.maxEvents = maxEvents || null;
    if (emailVerified === true) updates.emailVerifiedAt = new Date();
    if (emailVerified === false) updates.emailVerifiedAt = null;

    const [updated] = await db.update(clubsTable).set(updates).where(eq(clubsTable.id, id)).returning();
    res.json({ club: updated });
  } catch (err) {
    console.error("Admin update club error:", err);
    res.status(500).json({ error: "Failed to update club." });
  }
});

// DELETE /api/admin/clubs/:id — permanently delete a club and all its data
router.delete("/admin/clubs/:id", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const id = parseInt(req.params.id);

    // Delete in dependency order — children before parents
    await db.delete(evaluationsTable).where(eq(evaluationsTable.clubId, id));
    await db.delete(coachNotesTable).where(eq(coachNotesTable.clubId, id));
    await db.delete(rostersTable).where(eq(rostersTable.clubId, id)); // cascade deletes roster_players
    await db.delete(coachesTable).where(eq(coachesTable.clubId, id)); // cascade deletes wishlist/must-have
    await db.delete(staffTable).where(eq(staffTable.clubId, id));
    await db.delete(settingsTable).where(eq(settingsTable.clubId, id));
    await db.delete(syncLogsTable).where(eq(syncLogsTable.clubId, id));
    await db.delete(playersTable).where(eq(playersTable.clubId, id));
    await db.delete(clubsTable).where(eq(clubsTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error("Admin delete club error:", err);
    res.status(500).json({ error: "Failed to delete club." });
  }
});

// POST /api/admin/clubs/:id/reset-password — set a temporary password for a club
router.post("/admin/clubs/:id/reset-password", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const id = parseInt(req.params.id);
    const { password } = req.body ?? {};
    if (!password || typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(clubsTable).set({ passwordHash }).where(eq(clubsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin reset password error:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// POST /api/admin/clubs — create a new club
router.post("/admin/clubs", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const { name, email, password } = req.body ?? {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    const existing = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.email, email.toLowerCase()));
    if (existing.length > 0) {
      res.status(409).json({ error: "A club with this email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [club] = await db.insert(clubsTable).values({
      name,
      email: email.toLowerCase(),
      passwordHash,
      slug,
      status: "trial",
    }).returning();

    res.json({ club });
  } catch (err) {
    console.error("Admin create club error:", err);
    res.status(500).json({ error: "Failed to create club." });
  }
});

// POST /api/admin/clubs/:id/impersonate — get a JWT for a club (for troubleshooting)
router.post("/admin/clubs/:id/impersonate", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const id = parseInt(req.params.id);
    const [club] = await db.select({ id: clubsTable.id, name: clubsTable.name, email: clubsTable.email })
      .from(clubsTable).where(eq(clubsTable.id, id));

    if (!club) {
      res.status(404).json({ error: "Club not found." });
      return;
    }

    const token = jwt.sign({ clubId: club.id }, jwtSecret(), { expiresIn: "8h" });
    res.json({ token, club: { id: club.id, name: club.name, email: club.email } });
  } catch (err) {
    console.error("Admin impersonate error:", err);
    res.status(500).json({ error: "Failed to impersonate club." });
  }
});

// GET /api/admin/clubs/:id/users — list admin users for a club
router.get("/admin/clubs/:id/users", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const id = parseInt(req.params.id);
    const users = await db.select({ id: clubUsersTable.id, name: clubUsersTable.name, email: clubUsersTable.email, createdAt: clubUsersTable.createdAt })
      .from(clubUsersTable).where(eq(clubUsersTable.clubId, id));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

// POST /api/admin/clubs/:id/users — add an admin user to a club
router.post("/admin/clubs/:id/users", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const id = parseInt(req.params.id);
    const { name, email, password } = req.body ?? {};
    if (!name || !email || !password || password.length < 8) {
      res.status(400).json({ error: "Name, email, and password (min 8 chars) required." });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(clubUsersTable).values({ clubId: id, name, email: email.toLowerCase(), passwordHash }).returning();
    res.json({ user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } });
  } catch (err) {
    res.status(500).json({ error: "Failed to add user." });
  }
});

// DELETE /api/admin/clubs/:id/users/:userId — remove an admin user
router.delete("/admin/clubs/:id/users/:userId", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const userId = parseInt(req.params.userId);
    await db.delete(clubUsersTable).where(eq(clubUsersTable.id, userId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove user." });
  }
});

// POST /api/admin/clubs/:id/users/:userId/reset-password — reset a club admin user's password
router.post("/admin/clubs/:id/users/:userId/reset-password", async (req, res): Promise<void> => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const userId = parseInt(req.params.userId);
    const { password } = req.body ?? {};
    if (!password || typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(clubUsersTable).set({ passwordHash }).where(eq(clubUsersTable.id, userId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset password." });
  }
});


export default router;
