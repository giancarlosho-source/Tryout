import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";
import { coachesTable } from "./coaches";

export const rostersTable = pgTable("rosters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  coachId: integer("coach_id").references(() => coachesTable.id, { onDelete: "set null" }),
  setterSlots: integer("setter_slots").notNull().default(2),
  outsideHitterSlots: integer("outside_hitter_slots").notNull().default(3),
  middleBlockerSlots: integer("middle_blocker_slots").notNull().default(3),
  oppositeSlots: integer("opposite_slots").notNull().default(2),
  liberoSlots: integer("libero_slots").notNull().default(2),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const rosterPlayersTable = pgTable("roster_players", {
  id: serial("id").primaryKey(),
  rosterId: integer("roster_id").notNull().references(() => rostersTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  position: text("position").notNull(),
  locked: boolean("locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRosterSchema = createInsertSchema(rostersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRoster = z.infer<typeof insertRosterSchema>;
export type Roster = typeof rostersTable.$inferSelect;
export type RosterPlayer = typeof rosterPlayersTable.$inferSelect;
