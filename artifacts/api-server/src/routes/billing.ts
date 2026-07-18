import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { db, clubsTable, pendingSignupsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function resendClient() {
  const key = process.env["RESEND_API_KEY"];
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

function makeEmailVerifyToken(clubId: number, email: string): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign({ clubId, email, purpose: "email-verify" }, secret + ":email-verify", { expiresIn: "7d" });
}

const router: IRouter = Router();

function stripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

// Stripe moved current_period_end off the top-level Subscription object and
// onto each subscription item in this API version — read it from there.
function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const periodEnd = sub.items.data[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000) : null;
}

function jwtSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (!s) throw new Error("JWT_SECRET not set");
  return s;
}


function appUrl(): string {
  return process.env["APP_URL"] ?? "https://app.tryoutdesk.com";
}

async function resolveClubId(meta: Record<string, string>): Promise<number | null> {
  if (meta.clubId) return parseInt(meta.clubId);
  if (meta.email) {
    const [club] = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.email, meta.email));
    return club?.id ?? null;
  }
  return null;
}

// POST /api/billing/signup-trial — start trial signup via Stripe (no auth required)
router.post("/billing/signup-trial", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, agreedAt } = req.body ?? {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required." });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
      return;
    }

    const priceId = process.env["STRIPE_PRICE_ID"];
    if (!priceId) { res.status(500).json({ error: "Stripe price not configured." }); return; }

    // Check email not already registered
    const [existing] = await db.select({ id: clubsTable.id }).from(clubsTable)
      .where(eq(clubsTable.email, email.toLowerCase()));
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // Password hash goes in our own DB, not Stripe metadata — only the row id
    // is passed through Stripe, resolved back by the webhook once paid.
    const [pending] = await db.insert(pendingSignupsTable).values({
      name,
      email: email.toLowerCase(),
      slug,
      passwordHash,
      agreedAt: agreedAt ? new Date(agreedAt) : new Date(),
    }).returning();

    const s = stripe();
    const customer = await s.customers.create({ email: email.toLowerCase(), name });

    const session = await s.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
        metadata: { signup: "1", pendingSignupId: String(pending.id) },
      },
      payment_method_collection: "always",
      success_url: `${appUrl()}/?trial_started=1`,
      cancel_url: `${appUrl()}/`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Signup trial error:", err);
    res.status(500).json({ error: "Failed to start trial signup." });
  }
});

// POST /api/billing/checkout — create a Stripe Checkout session
router.post("/billing/checkout", async (req: Request, res: Response): Promise<void> => {
  try {
    const clubId = req.clubId;
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
    if (!club) { res.status(404).json({ error: "Club not found." }); return; }

    const priceId = process.env["STRIPE_PRICE_ID"];
    if (!priceId) { res.status(500).json({ error: "Stripe price not configured." }); return; }

    const s = stripe();

    // Re-use existing Stripe customer or create one
    let customerId = club.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await s.customers.create({
        email: club.email,
        name: club.name,
        metadata: { clubId: String(club.id) },
      });
      customerId = customer.id;
      await db.update(clubsTable).set({ stripeCustomerId: customerId }).where(eq(clubsTable.id, clubId));
    }

    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl()}/billing?subscribed=1`,
      cancel_url: `${appUrl()}/billing`,
      subscription_data: {
        metadata: { clubId: String(club.id) },
      },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session." });
  }
});

// POST /api/billing/portal — open Stripe Customer Portal
router.post("/billing/portal", async (req: Request, res: Response): Promise<void> => {
  try {
    const clubId = req.clubId;
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
    if (!club) { res.status(404).json({ error: "Club not found." }); return; }
    if (!club.stripeCustomerId) {
      res.status(400).json({ error: "No active subscription found." });
      return;
    }

    const session = await stripe().billingPortal.sessions.create({
      customer: club.stripeCustomerId,
      return_url: `${appUrl()}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err);
    res.status(500).json({ error: "Failed to open billing portal." });
  }
});

// GET /api/billing/status — return current billing info
router.get("/billing/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const clubId = req.clubId;
    const [club] = await db.select({
      status: clubsTable.status,
      plan: clubsTable.plan,
      trialEndsAt: clubsTable.trialEndsAt,
      stripeCustomerId: clubsTable.stripeCustomerId,
      stripeSubscriptionId: clubsTable.stripeSubscriptionId,
      subscriptionEndsAt: clubsTable.subscriptionEndsAt,
    }).from(clubsTable).where(eq(clubsTable.id, clubId));

    if (!club) { res.status(404).json({ error: "Club not found." }); return; }

    res.json({
      status: club.status,
      plan: club.plan,
      trialEndsAt: club.trialEndsAt,
      hasSubscription: !!club.stripeSubscriptionId,
      subscriptionEndsAt: club.subscriptionEndsAt,
    });
  } catch (err) {
    console.error("Billing status error:", err);
    res.status(500).json({ error: "Failed to get billing status." });
  }
});

// POST /api/billing/webhook — Stripe webhook handler (no auth middleware)
router.post("/billing/webhook", async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

  if (!webhookSecret) {
    res.status(500).json({ error: "Webhook secret not configured." });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(req.body as Buffer, sig as string, webhookSecret);
  } catch (err) {
    console.error("Webhook signature error:", err);
    res.status(400).json({ error: "Invalid webhook signature." });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const sub = await stripe().subscriptions.retrieve(session.subscription as string);
        const subMeta = sub.metadata ?? {};

        // New trial signup — create the club account now
        if (subMeta.signup === "1" && subMeta.pendingSignupId) {
          const [pending] = await db.select().from(pendingSignupsTable)
            .where(eq(pendingSignupsTable.id, parseInt(subMeta.pendingSignupId)));
          if (!pending) break;

          const trialEndsAt = sub.trial_end
            ? new Date(sub.trial_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const endsAt = subscriptionPeriodEnd(sub);
          const [club] = await db.insert(clubsTable).values({
            name: pending.name,
            slug: pending.slug || pending.email.split("@")[0],
            email: pending.email,
            passwordHash: pending.passwordHash,
            status: "trial",
            plan: "club",
            trialEndsAt,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionEndsAt: endsAt,
            termsAgreedAt: pending.agreedAt,
          }).returning();
          await db.delete(pendingSignupsTable).where(eq(pendingSignupsTable.id, pending.id));
          console.log(`New trial club created: ${club.id} (${pending.email})`);
          try {
            await resendClient().emails.send({
              from: "TryoutDesk <noreply@tryoutdesk.com>",
              to: club.email,
              subject: "Welcome to TryoutDesk — your trial is active",
              html: `
                <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
                  <div style="margin-bottom:28px">
                    <span style="font-family:'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:1.2rem;letter-spacing:0.06em;text-transform:uppercase">
                      Tryout<span style="color:#c8102e">Desk</span>
                    </span>
                  </div>
                  <h1 style="font-size:1.5rem;font-weight:800;margin:0 0 12px;color:#0c1a2e">You're in. Let's run a great tryout.</h1>
                  <p style="color:#555;margin:0 0 20px;line-height:1.7">
                    Hi <strong>${club.name}</strong>, your 30-day free trial is active. Here's everything you need to get started:
                  </p>

                  <div style="background:#f4f5f3;border-radius:8px;padding:20px 24px;margin-bottom:24px">
                    <p style="margin:0 0 12px;font-weight:700;color:#0c1a2e;font-size:0.95rem">GETTING STARTED</p>
                    <table style="width:100%;border-collapse:collapse">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e7ec;color:#555;font-size:0.9rem">
                          <strong style="color:#111">1. Import your players</strong><br>
                          Go to <em>Import CSV</em> to upload your registration list, or share the player entry link so athletes self-register.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e7ec;color:#555;font-size:0.9rem">
                          <strong style="color:#111">2. Set up a session</strong><br>
                          Go to <em>Sessions &amp; QR</em> to create your tryout event and generate the QR code for check-in.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#555;font-size:0.9rem">
                          <strong style="color:#111">3. Add your coaches</strong><br>
                          Go to <em>Staff &amp; Roles</em> to invite coaches. They can evaluate players from any phone or tablet — no install required.
                        </td>
                      </tr>
                    </table>
                  </div>

                  <a href="https://app.tryoutdesk.com" style="display:inline-block;background:#c8102e;color:#fff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:4px;margin-bottom:16px">
                    Open TryoutDesk →
                  </a>
                  <br>
                  <a href="https://app.tryoutdesk.com/verify-email?token=${encodeURIComponent(makeEmailVerifyToken(club.id, club.email))}" style="display:inline-block;margin-bottom:28px;font-size:0.85rem;color:#6b7280;text-decoration:underline">
                    Verify your email address
                  </a>

                  <p style="color:#555;margin:0 0 8px;line-height:1.7;font-size:0.9rem">
                    Your trial runs for 30 days — no charge until then. If you have any questions, just reply to this email and I'll help you get set up.
                  </p>
                  <p style="color:#555;margin:0 0 24px;font-size:0.9rem">— Gian, TryoutDesk</p>

                  <hr style="border:none;border-top:1px solid #e2e7ec;margin:24px 0">
                  <p style="color:#999;font-size:0.75rem;margin:0">
                    TryoutDesk · <a href="https://tryoutdesk.com" style="color:#999">tryoutdesk.com</a>
                  </p>
                </div>
              `,
            });
          } catch (emailErr) {
            console.error("Welcome email failed:", emailErr);
          }
          break;
        }

        // Existing club upgrading to paid
        const clubId = parseInt(subMeta.clubId ?? session.metadata?.clubId ?? "0");
        if (!clubId) break;
        const endsAt = subscriptionPeriodEnd(sub);
        await db.update(clubsTable).set({
          status: "active",
          plan: "club",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          subscriptionEndsAt: endsAt,
        }).where(eq(clubsTable.id, clubId));
        console.log(`Club ${clubId} activated via checkout`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string }).subscription;
        if (!subId) break;
        const sub = await stripe().subscriptions.retrieve(subId);
        const clubId = await resolveClubId(sub.metadata ?? {});
        if (!clubId) break;
        const endsAt = subscriptionPeriodEnd(sub);
        await db.update(clubsTable).set({ status: "active", subscriptionEndsAt: endsAt }).where(eq(clubsTable.id, clubId));
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string }).subscription;
        if (!subId) break;
        const sub = await stripe().subscriptions.retrieve(subId);
        const clubId = await resolveClubId(sub.metadata ?? {});
        if (!clubId) break;
        await db.update(clubsTable).set({ status: "past_due" }).where(eq(clubsTable.id, clubId));

        const [club] = await db
          .select({ email: clubsTable.email, name: clubsTable.name })
          .from(clubsTable)
          .where(eq(clubsTable.id, clubId));
        if (club) {
          try {
            await resendClient().emails.send({
              from: "TryoutDesk <noreply@tryoutdesk.com>",
              to: club.email,
              subject: "Action required — your TryoutDesk payment failed",
              html: `
                <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
                  <div style="margin-bottom:28px">
                    <span style="font-family:'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:1.2rem;letter-spacing:0.06em;text-transform:uppercase">
                      Tryout<span style="color:#c8102e">Desk</span>
                    </span>
                  </div>
                  <h1 style="font-size:1.4rem;font-weight:800;margin:0 0 12px;color:#0c1a2e">We couldn't process your payment</h1>
                  <p style="color:#555;margin:0 0 20px;line-height:1.7">
                    Hi <strong>${club.name}</strong>, your most recent TryoutDesk payment didn't go through. Your account has been marked as past due.
                  </p>
                  <p style="color:#555;margin:0 0 20px;line-height:1.7">
                    To keep access to TryoutDesk, please update your payment method as soon as possible. Stripe will automatically retry the charge — if the retries fail, your account will be suspended.
                  </p>
                  <a href="${appUrl()}/billing" style="display:inline-block;background:#c8102e;color:#fff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:4px;margin-bottom:28px">
                    Update Payment Method →
                  </a>
                  <p style="color:#555;margin:0 0 8px;line-height:1.7;font-size:0.9rem">
                    If you believe this is a mistake or need help, just reply to this email.
                  </p>
                  <p style="color:#555;margin:0 0 24px;font-size:0.9rem">— Gian, TryoutDesk</p>
                  <hr style="border:none;border-top:1px solid #e2e7ec;margin:24px 0">
                  <p style="color:#999;font-size:0.75rem;margin:0">
                    TryoutDesk · <a href="https://tryoutdesk.com" style="color:#999">tryoutdesk.com</a>
                  </p>
                </div>
              `,
            });
          } catch (emailErr) {
            console.error("Payment failed email error:", emailErr);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const clubId = await resolveClubId(sub.metadata ?? {});
        if (!clubId) break;

        const [club] = await db
          .select({ email: clubsTable.email, name: clubsTable.name })
          .from(clubsTable)
          .where(eq(clubsTable.id, clubId));

        await db
          .update(clubsTable)
          .set({ status: "cancelled", stripeSubscriptionId: null })
          .where(eq(clubsTable.id, clubId));

        if (club) {
          try {
            await resendClient().emails.send({
              from: "TryoutDesk <noreply@tryoutdesk.com>",
              to: club.email,
              subject: "Your TryoutDesk subscription has been cancelled",
              html: `
                <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#111">
                  <div style="margin-bottom:28px">
                    <span style="font-family:'Arial Narrow',Arial,sans-serif;font-weight:900;font-size:1.2rem;letter-spacing:0.06em;text-transform:uppercase">
                      Tryout<span style="color:#c8102e">Desk</span>
                    </span>
                  </div>
                  <h1 style="font-size:1.4rem;font-weight:800;margin:0 0 12px;color:#0c1a2e">Your subscription has been cancelled</h1>
                  <p style="color:#555;margin:0 0 20px;line-height:1.7">
                    Hi <strong>${club.name}</strong>, your TryoutDesk subscription has been cancelled and your account access has been disabled.
                  </p>
                  <p style="color:#555;margin:0 0 20px;line-height:1.7">
                    Your player data, evaluations, and session history are still on file. If you'd like a copy of your data before it's removed, just reply to this email and we'll send you an export.
                  </p>
                  <p style="color:#555;margin:0 0 20px;line-height:1.7">
                    Changed your mind? You can reactivate your account anytime.
                  </p>
                  <a href="${appUrl()}/billing" style="display:inline-block;background:#0c1a2e;color:#fff;text-decoration:none;font-weight:700;font-size:0.95rem;padding:14px 28px;border-radius:4px;margin-bottom:28px">
                    Reactivate Account →
                  </a>
                  <p style="color:#555;margin:0 0 8px;line-height:1.7;font-size:0.9rem">
                    Thanks for being part of TryoutDesk. If there's anything we could have done better, I'd genuinely love to hear it — just reply here.
                  </p>
                  <p style="color:#555;margin:0 0 24px;font-size:0.9rem">— Gian, TryoutDesk</p>
                  <hr style="border:none;border-top:1px solid #e2e7ec;margin:24px 0">
                  <p style="color:#999;font-size:0.75rem;margin:0">
                    TryoutDesk · <a href="https://tryoutdesk.com" style="color:#999">tryoutdesk.com</a>
                  </p>
                </div>
              `,
            });
          } catch (emailErr) {
            console.error("Cancellation email error:", emailErr);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const clubId = await resolveClubId(sub.metadata ?? {});
        if (!clubId) break;
        const endsAt = subscriptionPeriodEnd(sub);
        const newStatus = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : undefined;
        if (newStatus) {
          await db.update(clubsTable).set({ status: newStatus, subscriptionEndsAt: endsAt }).where(eq(clubsTable.id, clubId));
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
    return;
  }

  res.json({ received: true });
});

export default router;
