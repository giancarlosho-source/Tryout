import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const clubsTable = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  slug: text("slug"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  plan: text("plan"),
  maxCoaches: integer("max_coaches"),
  maxPlayers: integer("max_players"),
  maxEvents: integer("max_events"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionEndsAt: timestamp("subscription_ends_at", { withTimezone: true }),
  termsAgreedAt: timestamp("terms_agreed_at", { withTimezone: true }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
});

export type Club = typeof clubsTable.$inferSelect;
export type NewClub = typeof clubsTable.$inferInsert;
