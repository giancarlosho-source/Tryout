import cron from "node-cron";
import { and, eq, gte, lte } from "drizzle-orm";
import { Resend } from "resend";
import { db, clubsTable } from "@workspace/db";
import { logger } from "./logger";
import { spawn } from "node:child_process";
import { createGzip } from "node:zlib";

async function sendTrialReminders() {
  const resendKey = process.env["RESEND_API_KEY"];
  if (!resendKey) {
    logger.warn("RESEND_API_KEY not set — skipping trial reminders");
    return;
  }

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

  if (clubs.length === 0) {
    logger.info("Trial reminders: no clubs in window");
    return;
  }

  const resend = new Resend(resendKey);

  for (const club of clubs) {
    const endsOn = club.trialEndsAt
      ? new Date(club.trialEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "soon";

    try {
      await resend.emails.send({
        from: "TryoutDesk <noreply@tryoutdesk.com>",
        to: club.email,
        subject: `Your TryoutDesk trial ends ${endsOn} — action required`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
            <h2 style="margin:0 0 8px;font-size:22px;color:#111">Your free trial is ending soon</h2>
            <p style="color:#555;margin:0 0 20px">Hi <strong>${club.name}</strong>,</p>
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
            </p>
          </div>
        `,
      });
      logger.info(`Trial reminder sent to club ${club.id} (${club.email})`);
    } catch (err) {
      logger.error({ err, clubId: club.id }, "Failed to send trial reminder");
    }
  }

  logger.info(`Trial reminders: sent ${clubs.length}`);
}

async function runDatabaseBackup() {
  const resendKey = process.env["RESEND_API_KEY"];
  const dbUrl = process.env["DATABASE_URL"];
  if (!resendKey || !dbUrl) {
    logger.warn("Skipping DB backup — RESEND_API_KEY or DATABASE_URL not set");
    return;
  }

  const gzipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const pgDump = spawn("pg_dump", ["--no-owner", "--no-acl", "--format=plain", dbUrl], {
      env: { ...process.env },
    });
    const gzip = createGzip();

    pgDump.stdout.pipe(gzip);
    gzip.on("data", (chunk: Buffer) => chunks.push(chunk));
    gzip.on("end", () => resolve(Buffer.concat(chunks)));
    gzip.on("error", reject);
    pgDump.stderr.on("data", (d: Buffer) => logger.warn(`pg_dump stderr: ${d.toString()}`));
    pgDump.on("error", reject);
    pgDump.on("close", (code) => {
      if (code !== 0) reject(new Error(`pg_dump exited with code ${code}`));
    });
  });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `tryoutdesk-backup-${date}.sql.gz`;

  const resend = new Resend(resendKey);
  await resend.emails.send({
    from: "TryoutDesk <noreply@tryoutdesk.com>",
    to: "giancarlosho@gmail.com",
    subject: `DB backup ${date} — TryoutDesk`,
    html: `<p>Daily database backup attached (${(gzipBuffer.length / 1024).toFixed(0)} KB compressed).</p>`,
    attachments: [{ filename, content: gzipBuffer.toString("base64") }],
  });

  logger.info({ filename, bytes: gzipBuffer.length }, "Database backup sent");
}

export function startScheduler() {
  // Run daily at 9:17am UTC
  cron.schedule("17 9 * * *", () => {
    sendTrialReminders().catch(err => logger.error({ err }, "Trial reminder job failed"));
  }, { timezone: "UTC" });

  // Run daily at 02:00 UTC
  cron.schedule("0 2 * * *", () => {
    runDatabaseBackup().catch(err => logger.error({ err }, "Database backup job failed"));
  }, { timezone: "UTC" });

  logger.info("Scheduler started — trial reminders at 09:17 UTC, DB backup at 02:00 UTC");
}
