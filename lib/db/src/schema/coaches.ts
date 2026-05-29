import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const coachesTable = pgTable("coaches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  teamName: text("team_name").notNull(),
  draftPriority: text("draft_priority").default("[]").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coachWishlistTable = pgTable("coach_wishlist", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coachesTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.coachId, t.playerId)]);

export const coachMustHaveTable = pgTable("coach_must_have", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").notNull().references(() => coachesTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.coachId, t.playerId)]);

export const insertCoachSchema = createInsertSchema(coachesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertCoach = z.infer<typeof insertCoachSchema>;
export type Coach = typeof coachesTable.$inferSelect;
export type CoachWishlistEntry = typeof coachWishlistTable.$inferSelect;
export type CoachMustHaveEntry = typeof coachMustHaveTable.$inferSelect;
