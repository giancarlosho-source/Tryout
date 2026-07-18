import { Router, type IRouter } from "express";
import { timingSafeEqual } from "crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import { Resend } from "resend";
import { db, clubsTable } from "@workspace/db";

const router: IRouter = Router();

function resend() {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

function cronSecret() {
  return process.env["CRON_SECRET"] ?? "";
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// POST /api/cron/trial-reminders — called daily by Railway cron
// Protected by a shared secret so only Railway can trigger it
router.post("/cron/trial-reminders", async (req, res) => {
  const secret = req.headers["x-cron-secret"];
  if (typeof secret !== "string" || !secretsMatch(secret, cronSecret())) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Find clubs whose trial ends in 6–8 days (window to avoid duplicates on retry)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

    const clubs = await db
      .select({ id: clubsTable.id, name: clubsTable.name, email: clubsTable.email, trialEndsAt: clubsTable.trialEndsAt })
      .from(clubsTable)
      .where(
        and(
          eq(clubsTable.status, "trial"),
          gte(clubsTable.trialEndsAt, windowStart),
          lte(clubsTable.trialEndsAt, windowEnd),
        )
      );

    const r = resend();
    let sent = 0;

    for (const club of clubs) {
      const endsOn = club.trialEndsAt
        ? new Date(club.trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "in 7 days";

      await r.emails.send({
        from: "TryoutDesk <noreply@tryoutdesk.com>",
        to: club.email,
        subject: `Your TryoutDesk trial ends ${endsOn} — action required`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
            <h2 style="margin:0 0 8px;font-size:22px;color:#111">Your free trial is ending soon</h2>
            <p style="color:#555;margin:0 0 20px">
              Hi <strong>${club.name}</strong>,
            </p>
            <p style="color:#555;margin:0 0 20px">
              Your TryoutDesk free trial ends on <strong>${endsOn}</strong>. After that date,
              your card on file will be charged <strong>$799</strong> for the annual Club License —
              giving you unlimited events, unlimited players, and full access for a full year.
            </p>
            <p style="color:#555;margin:0 0 28px">
              If you'd like to continue, no action is needed. If you'd like to cancel, you can do so
              anytime before <strong>${endsOn}</strong> from your billing page.
            </p>
            <a href="https://app.tryoutdesk.com/billing"
               style="display:inline-block;background:#e11d48;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;margin-bottom:28px">
              Manage My Subscription
            </a>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
            <p style="color:#999;font-size:12px;margin:0">
              Questions? Reply to this email or visit
              <a href="https://app.tryoutdesk.com" style="color:#e11d48">app.tryoutdesk.com</a>.
              TryoutDesk · Built for volleyball clubs.
            </p>
          </div>
        `,
      });

      sent++;
    }

    res.json({ ok: true, sent, total: clubs.length });
  } catch (err) {
    console.error("Trial reminder cron error:", err);
    res.status(500).json({ error: "Cron job failed." });
  }
});

export default router;
