import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { db, clubsTable, playersTable, evaluationsTable, coachNotesTable, rostersTable, rosterPlayersTable, coachesTable, coachWishlistTable, coachMustHaveTable, staffTable, settingsTable, syncLogsTable, clubUsersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

function resendClient() {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const router: IRouter = Router();

function jwtSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (!s) throw new Error("JWT_SECRET env var is not set");
  return s;
}

function clubPayload(club: typeof clubsTable.$inferSelect) {
  return {
    id: club.id,
    slug: club.slug,
    name: club.name,
    email: club.email,
    logoUrl: club.logoUrl,
    primaryColor: club.primaryColor,
    status: club.status,
    plan: club.plan,
    trialEndsAt: club.trialEndsAt,
    subscriptionEndsAt: club.subscriptionEndsAt,
    hasStripeSubscription: !!club.stripeCustomerId,
    emailVerified: !!club.emailVerifiedAt,
  };
}

function verifyEmailSecret(): string {
  return jwtSecret() + ":email-verify";
}

function makeVerifyToken(clubId: number, email: string): string {
  return jwt.sign({ clubId, email, purpose: "email-verify" }, verifyEmailSecret(), { expiresIn: "7d" });
}

async function sendVerificationEmail(club: { id: number; name: string; email: string }): Promise<void> {
  const token = makeVerifyToken(club.id, club.email);
  const link = `https://app.tryoutdesk.com/verify-email?token=${encodeURIComponent(token)}`;
  await resendClient().emails.send({
    from: "TryoutDesk <noreply@tryoutdesk.com>",
    to: club.email,
    subject: "Please verify your TryoutDesk email address",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
        <div style="margin-bottom:28px">
          <span style="font-family:'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:1.2rem;letter-spacing:0.06em;text-transform:uppercase">
            Tryout<span style="color:#c8102e">Desk</span>
          </span>
        </div>
        <h1 style="font-size:1.4rem;font-weight:800;margin:0 0 12px;color:#0c1a2e">Verify your email address</h1>
        <p style="color:#555;margin:0 0 24px;line-height:1.7">
          Hi <strong>${club.name}</strong>, click the button below to confirm your email address and secure your account.
        </p>
        <a href="${link}" style="display:inline-block;background:#c8102e;color:#fff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:4px;margin-bottom:28px">
          Verify Email →
        </a>
        <p style="color:#999;font-size:0.8rem;margin:0 0 4px">This link expires in 7 days.</p>
        <p style="color:#999;font-size:0.8rem;margin:0">If you didn't create a TryoutDesk account, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e2e7ec;margin:24px 0">
        <p style="color:#999;font-size:0.75rem;margin:0">TryoutDesk · <a href="https://tryoutdesk.com" style="color:#999">tryoutdesk.com</a></p>
      </div>
    `,
  });
}

function getClubId(req: { headers: { authorization?: string } }): number {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) throw new Error("No token");
  const payload = jwt.verify(header.slice(7), jwtSecret()) as { clubId: number };
  return payload.clubId;
}

// POST /api/auth/signup — disabled; all signups go through Stripe billing flow
router.post("/auth/signup", (_req, res): void => {
  res.status(410).json({ error: "Direct signup is disabled. Please use the trial signup flow." });
});

// POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required." });
      return;
    }

    // Check primary club account first
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.email, email.toLowerCase()));
    if (club) {
      const match = await bcrypt.compare(password, club.passwordHash);
      if (!match) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }
      const token = jwt.sign({ clubId: club.id, email: club.email }, jwtSecret(), { expiresIn: "30d" });
      const [forceSetting] = await db.select().from(settingsTable)
        .where(and(eq(settingsTable.clubId, club.id), eq(settingsTable.key, "password.force_change")));
      console.log(`Login: club=${club.id} forceSetting=${JSON.stringify(forceSetting)} forcePasswordChange=${!!forceSetting}`);
      res.json({ token, club: clubPayload(club), forcePasswordChange: !!forceSetting });
      return;
    }

    // Check club_users (additional admins)
    const [clubUser] = await db.select().from(clubUsersTable).where(eq(clubUsersTable.email, email.toLowerCase()));
    if (!clubUser) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    const userMatch = await bcrypt.compare(password, clubUser.passwordHash);
    if (!userMatch) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    const [userClub] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubUser.clubId));
    if (!userClub) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    const token = jwt.sign({ clubId: userClub.id, email: clubUser.email }, jwtSecret(), { expiresIn: "30d" });
    res.json({ token, club: clubPayload(userClub) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Login error:", msg);
    if (msg.includes("column") && msg.includes("does not exist")) {
      res.status(500).json({ error: "Database schema is being updated. Please try again in 30 seconds." });
    } else {
      res.status(500).json({ error: "Server error during login. Please try again." });
    }
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
    const [forceSetting] = await db.select().from(settingsTable)
      .where(and(eq(settingsTable.clubId, club.id), eq(settingsTable.key, "password.force_change")));
    res.json({ club: clubPayload(club), forcePasswordChange: !!forceSetting });
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
});

// GET /api/auth/status — tells the dashboard whether signup is needed or login is needed
router.get("/auth/status", async (_req, res): Promise<void> => {
  const existing = await db.select().from(clubsTable).limit(1);
  res.json({ hasClub: existing.length > 0 });
});

// POST /api/auth/logo — upload club logo (base64 data URL)
router.post("/auth/logo", async (req, res): Promise<void> => {
  try {
    const clubId = getClubId(req);
    const { logoUrl } = req.body ?? {};
    if (!logoUrl || typeof logoUrl !== "string" || !logoUrl.startsWith("data:image/")) {
      res.status(400).json({ error: "logoUrl must be a base64 image data URL." });
      return;
    }
    if (logoUrl.length > 3_000_000) {
      res.status(400).json({ error: "Logo must be under 2 MB." });
      return;
    }
    await db.update(clubsTable).set({ logoUrl }).where(eq(clubsTable.id, clubId));
    res.json({ ok: true, logoUrl });
  } catch {
    res.status(500).json({ error: "Failed to save logo." });
  }
});

// PUT /api/auth/club — update club name and/or primary color
router.put("/auth/club", async (req, res): Promise<void> => {
  try {
    const clubId = getClubId(req);
    const { name, primaryColor } = req.body ?? {};
    const updates: Partial<typeof clubsTable.$inferInsert> = {};
    if (name && typeof name === "string" && name.trim()) {
      updates.name = name.trim();
      updates.slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    if (primaryColor && typeof primaryColor === "string") updates.primaryColor = primaryColor;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update." });
      return;
    }
    const [updated] = await db.update(clubsTable).set(updates).where(eq(clubsTable.id, clubId)).returning();
    res.json({ club: clubPayload(updated) });
  } catch {
    res.status(500).json({ error: "Failed to update club." });
  }
});

// POST /api/auth/forgot-password — send temp password via email
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  try {
    const { email } = req.body ?? {};
    if (!email) { res.status(400).json({ error: "Email is required." }); return; }

    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.email, email.toLowerCase()));

    // Always return success — don't reveal whether the email exists
    if (!club) { res.json({ ok: true }); return; }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await db.update(clubsTable).set({ passwordHash }).where(eq(clubsTable.id, club.id));
    await db.insert(settingsTable).values({ clubId: club.id, key: "password.force_change", value: "1" })
      .onConflictDoUpdate({ target: [settingsTable.clubId, settingsTable.key], set: { value: "1" } });

    const resend = resendClient();
    await resend.emails.send({
      from: "TryoutDesk <noreply@tryoutdesk.com>",
      to: club.email,
      subject: "Your temporary TryoutDesk password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px;font-size:22px;color:#111">Password Reset</h2>
          <p style="color:#555;margin:0 0 24px">Hi <strong>${club.name}</strong>, here is your temporary password:</p>
          <div style="background:#f4f4f5;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
            <span style="font-family:monospace;font-size:26px;font-weight:700;letter-spacing:2px;color:#111">${tempPassword}</span>
          </div>
          <p style="color:#555;margin:0 0 8px">Log in at <a href="https://app.tryoutdesk.com" style="color:#e11d48">app.tryoutdesk.com</a> with this password.</p>
          <p style="color:#555;margin:0 0 24px">After logging in, go to <strong>Club Settings → Change Password</strong> to set a new one.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
          <p style="color:#999;font-size:12px;margin:0">If you didn't request this, you can ignore this email. Your account is safe.</p>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to send reset email. Please try again." });
  }
});

// PUT /api/auth/password — change own password
router.put("/auth/password", async (req, res): Promise<void> => {
  try {
    const clubId = getClubId(req);
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required." });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters." });
      return;
    }
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
    if (!club) { res.status(404).json({ error: "Club not found." }); return; }
    const match = await bcrypt.compare(currentPassword, club.passwordHash);
    if (!match) { res.status(401).json({ error: "Current password is incorrect." }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(clubsTable).set({ passwordHash }).where(eq(clubsTable.id, clubId));
    await db.delete(settingsTable).where(and(eq(settingsTable.clubId, clubId), eq(settingsTable.key, "password.force_change")));
    res.json({ ok: true });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password." });
  }
});

// GET /api/auth/verify-email?token= — confirm email from link in welcome/verify email
router.get("/auth/verify-email", async (req, res): Promise<void> => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) { res.status(400).json({ error: "Missing token." }); return; }
    const payload = jwt.verify(token, verifyEmailSecret()) as { clubId: number; email: string; purpose: string };
    if (payload.purpose !== "email-verify") { res.status(400).json({ error: "Invalid token." }); return; }
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, payload.clubId));
    if (!club) { res.status(404).json({ error: "Club not found." }); return; }
    if (club.emailVerifiedAt) { res.json({ ok: true, alreadyVerified: true }); return; }
    await db.update(clubsTable).set({ emailVerifiedAt: new Date() }).where(eq(clubsTable.id, club.id));
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid or expired verification link." });
  }
});

// POST /api/auth/resend-verification — send a fresh verification email (requires auth)
router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  try {
    const clubId = getClubId(req);
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
    if (!club) { res.status(404).json({ error: "Club not found." }); return; }
    if (club.emailVerifiedAt) { res.json({ ok: true, alreadyVerified: true }); return; }
    await sendVerificationEmail(club);
    res.json({ ok: true });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ error: "Failed to send verification email." });
  }
});

// DELETE /api/auth/club — permanently delete all club data
router.delete("/auth/club", async (req, res): Promise<void> => {
  try {
    const clubId = getClubId(req);

    // Require the caller to type the club name as a confirmation guard
    const [club] = await db.select({ name: clubsTable.name }).from(clubsTable).where(eq(clubsTable.id, clubId));
    if (!club) { res.status(404).json({ error: "Club not found." }); return; }

    const { confirmName } = req.body as { confirmName?: string };
    if (!confirmName || confirmName.trim().toLowerCase() !== club.name.trim().toLowerCase()) {
      res.status(400).json({ error: `Type your club name exactly to confirm deletion.` });
      return;
    }

    // Delete in dependency order (children before parents)
    await db.delete(evaluationsTable).where(eq(evaluationsTable.clubId, clubId));
    await db.delete(coachNotesTable).where(eq(coachNotesTable.clubId, clubId));
    // rosterPlayersTable cascades from rostersTable
    await db.delete(rostersTable).where(eq(rostersTable.clubId, clubId));
    // coachWishlistTable and coachMustHaveTable cascade from coachesTable
    await db.delete(coachesTable).where(eq(coachesTable.clubId, clubId));
    await db.delete(staffTable).where(eq(staffTable.clubId, clubId));
    await db.delete(settingsTable).where(eq(settingsTable.clubId, clubId));
    await db.delete(syncLogsTable).where(eq(syncLogsTable.clubId, clubId));
    await db.delete(playersTable).where(eq(playersTable.clubId, clubId));
    await db.delete(clubsTable).where(eq(clubsTable.id, clubId));
    res.json({ ok: true, message: "All club data has been permanently deleted." });
  } catch (err) {
    console.error("Delete club error:", err);
    res.status(500).json({ error: "Failed to delete club data." });
  }
});

export default router;
