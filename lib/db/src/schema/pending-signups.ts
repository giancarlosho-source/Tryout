import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

// Holds signup details (including the password hash) between Stripe Checkout
// session creation and the checkout.session.completed webhook that actually
// creates the club row. Only a signupId is passed through Stripe metadata,
// not the password hash itself — Stripe isn't a secrets store.
export const pendingSignupsTable = pgTable("pending_signups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  slug: text("slug").notNull(),
  passwordHash: text("password_hash").notNull(),
  agreedAt: timestamp("agreed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PendingSignup = typeof pendingSignupsTable.$inferSelect;
