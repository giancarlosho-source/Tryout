# TryoutDesk Runbook

A practical troubleshooting guide for when things break in production.
Keep this file. You don't need Claude to fix most of these.

**Keep this current.** You're running this solo — there's no teammate who
absorbs tacit knowledge by osmosis. Every time you track down something
non-obvious (a weird bug, a gotcha in a deploy step, a "why does this work
this way"), add a few lines here before you move on. A runbook that's a
year stale is worse than useless — it actively misleads whoever reads it
next, including future-you.

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
2. [How to Deploy](#2-how-to-deploy)
3. [How to Read Logs](#3-how-to-read-logs)
4. [Stripe / Billing Issues](#4-stripe--billing-issues)
5. [Login & Auth Issues](#5-login--auth-issues)
6. [Frontend Issues](#6-frontend-issues)
7. [Database Issues](#7-database-issues)
8. [Email Issues](#8-email-issues)
9. [Backups & Restore](#9-backups--restore)
10. [Monitoring & Alerting](#10-monitoring--alerting)
11. [Nuclear Options](#11-nuclear-options)

---

## 1. Quick Reference

| What | Where | How to access |
|---|---|---|
| API server | Railway | railway.com → project → service |
| Database | Railway (Postgres) | Railway dashboard → Postgres service |
| Frontend | Vercel | vercel.com → tryout-app project |
| Stripe | Stripe dashboard | dashboard.stripe.com |
| Email logs | Resend | resend.com → Emails |
| Domain | app.tryoutdesk.com | Points to Vercel deployment |
| Webhook URL | Stripe → Workbench → Webhooks | https://[railway-url]/api/billing/webhook |

**Workspace root (always use this for deploys):**
```
/Users/gian/Downloads/tribe-tryouts-export-new
```

### Known limitations (not bugs, but worth knowing before you hit them)

- **Rate limiting is in-memory** (`artifacts/api-server/src/app.ts`) — it
  tracks attempts per-IP in a `Map` inside the running process. This works
  fine on Railway's current single-instance setup, but resets on every
  deploy/restart and would silently stop being effective (each instance
  would have its own separate counter) if the API server is ever scaled to
  multiple instances. If you scale out, this needs to move to a shared
  store (e.g. Redis) first.

---

## 2. How to Deploy

### Deploy the API (backend)

Always run from the workspace root, NOT from inside `artifacts/api-server`.

```bash
cd /Users/gian/Downloads/tribe-tryouts-export-new
railway up --detach
```

Wait ~3 minutes, then check Railway dashboard to confirm the deploy succeeded.

If Railway says you're not logged in:
```bash
railway login --browserless
# Follow the code prompt in the terminal
```

### Deploy the Frontend (web app)

```bash
cd /Users/gian/Downloads/tribe-tryouts-export-new/artifacts/tryout-app
npm run build
vercel deploy --prebuilt
# Copy the deployment URL it gives you, then run:
vercel alias set [paste-url-here] app.tryoutdesk.com
```

**Important:** The `vercel alias set` step is required every time. Without it, the domain still points to the old version.

### Running the API tests before deploying

The `artifacts/api-server` test suite (`src/__tests__/`) covers cross-tenant
data isolation — it's the regression suite for a real bug class that's bitten
this app before, so it's worth running before deploying backend changes.

```bash
cd /Users/gian/Downloads/tribe-tryouts-export-new/artifacts/api-server
pnpm test
```

This spins up a throwaway Postgres via `docker-compose.test.yml`, runs the
real `migrate.mjs` against it (same migration path as production), runs the
suite, then tears the DB down. Requires Docker.

**No Docker available?** Use a local Postgres instead — e.g. via Homebrew:
```bash
brew install postgresql@16
/opt/homebrew/opt/postgresql@16/bin/initdb -D /tmp/tryoutdesk-pgdata -U test -A trust
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /tmp/tryoutdesk-pgdata -l /tmp/pg-test.log -o "-p 5433 -k /tmp" start
/opt/homebrew/opt/postgresql@16/bin/createdb -h /tmp -p 5433 -U test tryoutdesk_test
pnpm run test:local-pg
```
Re-run `dropdb`/`createdb` between runs if you hit a duplicate-key error from
leftover test data — the suite doesn't currently clean up after itself.

---

## 3. How to Read Logs

### API server logs (Railway)

```bash
railway logs --tail 200
```

For errors specifically:
```bash
railway logs --tail 2000 2>&1 | grep -A 15 "Error\|error\|ERROR"
```

For webhook errors specifically:
```bash
railway logs --tail 2000 2>&1 | grep -A 15 "Webhook handler error"
```

### What the log lines mean

- `request completed` with `statusCode: 200` → success
- `request completed` with `statusCode: 500` → server error, look for the error message above that line
- `request errored` → unhandled exception, look at the `err.message` field below it

---

## 4. Stripe / Billing Issues

### A club says "Free Trial Active" but their trial ended and they paid

**What happened:** The `customer.subscription.updated` webhook either failed or wasn't delivered.

**Fix:**
1. Go to Stripe Dashboard → Workbench → Webhooks → TryoutDesk Railway
2. Click **Event deliveries**
3. Find the `customer.subscription.updated` event for that customer (search by date or email in description)
4. Click **Resend**
5. Refresh the billing page — it should now show Active

If the resend also fails (shows 500):
- Check Railway logs for `Webhook handler error` to see the actual error message
- Then follow the relevant fix below

---

### Webhook returns 500 "Webhook processing failed"

**Step 1:** Get the actual error from logs:
```bash
railway logs --tail 2000 2>&1 | grep -A 15 "Webhook handler error"
```

**Common errors and fixes:**

#### `RangeError: Invalid time value`
- **Cause:** A Stripe timestamp field (`current_period_end`, `trial_end`) was null/undefined and the code tried to do `new Date(null * 1000)`.
- **Where:** `artifacts/api-server/src/routes/billing.ts`
- **Fix:** Find the line doing `new Date(sub.current_period_end * 1000)` and change it to:
  ```typescript
  const endsAt = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  ```
  Then redeploy.

#### `Invalid webhook signature`
- **Cause:** The `STRIPE_WEBHOOK_SECRET` environment variable on Railway is wrong or missing.
- **Fix:** Go to Stripe → Workbench → Webhooks → click the webhook → reveal the signing secret. Then go to Railway → service → Variables → update `STRIPE_WEBHOOK_SECRET`.

#### Club not found (silent no-op — webhook returns 200 but nothing changes)
- **Cause:** The subscription metadata doesn't have `email` or `clubId` that matches a club in the DB.
- **Fix:** Check the subscription metadata in Stripe: Dashboard → Customers → find customer → Subscriptions → click subscription → scroll to Metadata. The `email` field must match exactly what's in the database.

---

### "No active subscription found" when clicking Manage Subscription

**Cause:** The club account was manually activated (no Stripe customer attached), so there's no portal to open.

**Fix:** This is expected behavior for manually-activated accounts. The button should say "Subscribe" instead of "Manage Subscription" — if it doesn't, there may be a frontend bug.

---

### What is the `pending_signups` table?

Holds the name/email/password hash for a trial signup between the moment
someone submits the signup form and the moment Stripe confirms the checkout
(`checkout.session.completed` webhook) — the club row only gets created once
payment is confirmed. Only the row's id travels through Stripe metadata, not
the password hash itself.

**If you see rows sitting here for a long time:** it means someone started
signing up but never completed Stripe checkout (closed the tab, card
declined, etc.) — not a bug. There's currently no automatic cleanup job for
abandoned rows; if the table grows large, it's safe to manually delete rows
older than a few days that don't have a matching `clubs.email`.

---

### A club got charged but is still showing as expired/cancelled

**Fix:**
1. Stripe → Customers → find the customer → check their subscription status
2. If Stripe shows "Active" but the app shows otherwise, find the `invoice.paid` or `customer.subscription.updated` event in Webhook Event deliveries and **Resend** it
3. If the webhook keeps failing, check Railway logs for the error

---

### How to give a club a free extension (manually)

Use the Railway Postgres console or a temporary API endpoint:

```sql
UPDATE clubs SET trial_ends_at = NOW() + INTERVAL '30 days' WHERE email = 'club@example.com';
-- Or to set them active permanently:
UPDATE clubs SET status = 'active', subscription_ends_at = NOW() + INTERVAL '1 year' WHERE email = 'club@example.com';
```

To run SQL on Railway: Dashboard → Postgres service → Data tab → Query.

---

### How to process a refund

1. Stripe Dashboard → Customers → find the customer
2. Click on the Payment → Refund
3. Choose full or partial amount
4. Then manually update their status in the DB (see above) or cancel their subscription in Stripe

---

## 5. Login & Auth Issues

### "Server error during login"

**Cause:** Usually the DB is missing a column that the server is trying to SELECT.

**Check:** Railway logs will show a Postgres error like `column "stripe_customer_id" does not exist`.

**Fix:** Run the missing migration via Railway's Data tab (Query section):
```sql
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
```

---

### A club owner forgot their password

There's no password reset flow built yet. Manual fix via Railway Postgres Query:

```bash
# First generate a new bcrypt hash locally:
node -e "const b = require('bcryptjs'); b.hash('NewPassword123', 12).then(console.log)"
```

Then in Railway → Postgres → Query:
```sql
UPDATE clubs SET password_hash = '[paste hash here]' WHERE email = 'club@example.com';
```

Then tell them their temporary password and ask them to change it (no in-app change yet — they'd need to re-register or you'd need to build a reset page).

---

### JWT errors / "invalid token" for all users

**Cause:** The `JWT_SECRET` environment variable on Railway changed or was reset.

**Fix:** All existing JWTs are now invalid (users are logged out). This is safe — they just log in again. Make sure the Railway variable is set and not empty.

---

## 6. Frontend Issues

### app.tryoutdesk.com shows old version after deploy

**Fix:**
```bash
vercel alias set [new-deployment-url] app.tryoutdesk.com
```

To find the current deployment URL:
```bash
cd /Users/gian/Downloads/tribe-tryouts-export-new/artifacts/tryout-app
vercel ls
```

---

### 404 on page refresh (e.g., refreshing /billing)

**Cause:** Vercel doesn't know to serve index.html for SPA routes.

**Fix:** Check that `artifacts/tryout-app/.vercel/output/config.json` has the SPA catch-all routes. If the file was accidentally deleted or corrupted, the config needs to be restored. The file should have `"routes"` that rewrite `.*` to `/index.html`.

---

### App loads but shows a blank white screen

**Check browser console (F12 → Console tab):**
- `Failed to fetch` → API server is down. Check Railway.
- `401 Unauthorized` → JWT expired, user needs to log out and back in.
- JavaScript error → Frontend bug, check the error message for the file/line.

---

## 7. Database Issues

### How to query the database

Railway Dashboard → Postgres service → **Data** tab → **Query** tab.

Useful queries:
```sql
-- See all clubs and their status
SELECT id, name, email, status, trial_ends_at, subscription_ends_at, stripe_customer_id FROM clubs ORDER BY created_at DESC;

-- Find a specific club
SELECT * FROM clubs WHERE email = 'club@example.com';

-- See clubs whose trial expires soon
SELECT name, email, trial_ends_at FROM clubs WHERE status = 'trial' AND trial_ends_at < NOW() + INTERVAL '7 days' ORDER BY trial_ends_at;

-- See how many events a trial club has used
SELECT * FROM settings WHERE club_id = [id] AND key = 'trial.events_used';
```

---

### Database is not reachable from your laptop

**This is by design.** Railway's Postgres only allows connections from within Railway's private network.

All DB operations must go through:
1. Railway's Data tab (for direct SQL)
2. The API server (via curl or the app)
3. A temporary endpoint added to the code and deployed

---

## 8. Email Issues

### Trial reminder emails are not being sent

**Check 1:** Resend dashboard → look for recent sends from `noreply@tryoutdesk.com`.

**Check 2:** The scheduler runs daily at 09:17 UTC. It only sends to clubs with `trialEndsAt` between 6 and 8 days from now. If no clubs are in that window, no emails go out — this is correct behavior.

**Check 3:** Manually trigger the reminder job:
```bash
curl -X POST https://[railway-url]/api/cron/trial-reminders \
  -H "x-cron-secret: [CRON_SECRET value from Railway env vars]"
```
Response should be `{"ok":true,"sent":N,"total":N}`.

**Check 4:** Railway logs after the 09:17 UTC cron time:
```bash
railway logs --tail 500 2>&1 | grep -i "trial reminder\|scheduler\|cron"
```

---

### Emails going to spam

- Make sure Resend domain `tryoutdesk.com` has SPF, DKIM, and DMARC DNS records configured. Check Resend dashboard → Domains.
- The `from` address must be `noreply@tryoutdesk.com` (not a Gmail or other address).

---

## 9. Backups & Restore

### What's backed up, and how

A daily job dumps the production Postgres database (`pg_dump`), gzips it, and
emails it via Resend at **02:00 UTC**. There is no separate off-site backup
storage beyond that emailed archive — the email *is* the backup.

**Where to find backups:** search the inbox that receives `noreply@tryoutdesk.com`
(or whichever address the backup job sends to) for the daily backup subject
line, or check Railway logs around 02:00 UTC for the backup job's output to
confirm it ran and succeeded.

### How to restore from a backup

1. Download the `.sql.gz` attachment from the relevant day's backup email.
2. Unzip it: `gunzip backup-YYYY-MM-DD.sql.gz`
3. Get a connection string for the target database (Railway → Postgres
   service → Variables → `DATABASE_URL` — you'll need Railway's Postgres
   proxy/public URL, not the private one, since your laptop can't reach the
   private network directly; see §7 for why).
4. Restore:
   ```bash
   psql "<connection-string>" < backup-YYYY-MM-DD.sql
   ```
5. **Before restoring over a live database**, take a fresh backup first
   (`pg_dump "<connection-string>" | gzip > pre-restore-safety.sql.gz`) so a
   bad restore is itself reversible.

### If the daily backup job stops running

Check Railway logs for the scheduled job around 02:00 UTC
(`artifacts/api-server/src/lib/scheduler.ts` registers it via `node-cron`).
If it's silently failing, the most likely causes are `RESEND_API_KEY` being
invalid/expired or the Postgres connection being unreachable at job time.

### Known gap

There is currently no *tested* restore drill — the process above is
inferred from how the backup is produced, not exercised end-to-end. Before
you need it in a real emergency, it's worth doing one practice restore into
a scratch Railway Postgres instance to confirm the steps actually work.

---

## 10. Monitoring & Alerting

### What exists today

- **Sentry** is wired up (`SENTRY_DSN` env var) and captures unhandled
  exceptions and Express error-handler catches from the API server. Check
  the Sentry dashboard for the TryoutDesk project for recent errors.
- **Health check:** `GET /api/healthz` checks DB connectivity and is used by
  Railway to detect a broken deploy.
- **CI:** GitHub Actions runs the tenant-isolation test suite on every push
  and PR to `main` (`.github/workflows/ci.yml`).

### What does NOT exist today

- **No alert routing.** Sentry capturing an error does not page or notify
  anyone by default — you have to go look at the dashboard. If you want to
  be notified proactively (e.g. of a spike in 500s, or the backup job
  failing), set up Sentry alert rules → email/Slack notification.
- **No uptime monitoring.** Nothing external pings `app.tryoutdesk.com` or
  the API `/healthz` endpoint on a schedule to alert you if the app goes
  down while you're not looking. A free tier of an uptime checker (e.g.
  UptimeRobot, Better Stack) pointed at `/api/healthz` would close this gap
  cheaply.
- **No structured alerting on the trial-reminder or backup cron jobs** —
  if either silently stops running, the only way to notice today is to
  manually check Railway logs (see §8 and §9 above).

---

## 11. Nuclear Options

### Restart the API server

Railway Dashboard → your service → **...** menu → **Restart**.

This is safe. It will briefly disconnect users (a few seconds) but reconnects automatically.

---

### Roll back to a previous API deploy

Railway Dashboard → your service → **Deployments** tab → find a previous successful deploy → click **...** → **Redeploy**.

---

### Roll back to a previous frontend deploy

```bash
vercel ls  # find the old deployment URL
vercel alias set [old-deployment-url] app.tryoutdesk.com
```

---

### Switch from Stripe test keys to live keys

When ready to accept real payments:

1. Stripe Dashboard → top-left toggle → switch to **Live mode**
2. Get new keys: API keys page → reveal Secret key
3. Railway → service → Variables:
   - Update `STRIPE_SECRET_KEY` (starts with `sk_live_`)
   - Update `STRIPE_PRICE_ID` (create a new product/price in live mode first)
4. Set up a new webhook in Stripe live mode pointing to the same Railway URL
   - Update `STRIPE_WEBHOOK_SECRET` with the new live webhook signing secret
5. Deploy to pick up the new env vars

**Warning:** Test mode and live mode are completely separate. Test payments and test customers do not carry over.

---

### Someone is abusing the free trial (multiple accounts)

The system requires a real credit card to start a trial, which limits abuse. But if someone is using disposable cards:

1. Stripe Dashboard → Customers → look for suspicious patterns (same card, similar names)
2. Cancel their subscription in Stripe
3. In Railway Postgres → Query:
   ```sql
   UPDATE clubs SET status = 'cancelled' WHERE email IN ('abuse1@example.com', 'abuse2@example.com');
   ```

---

*Last updated: July 2026*
*Built with: Node/Express + Railway + React/Vite + Vercel + Stripe + Resend*
