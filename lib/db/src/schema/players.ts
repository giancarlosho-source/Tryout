import { pgTable, text, serial, timestamp, boolean, real, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  jerseyNumber: text("jersey_number"),
  name: text("name").notNull(),
  position: text("position"),
  checkedIn: boolean("checked_in").notNull().default(false),
  heightInches: real("height_inches"),
  standingReachInches: real("standing_reach_inches"),
  verticalJumpInches: real("vertical_jump_inches"),
  overallScore: real("overall_score"),
  positionScore: real("position_score"),
  potentialScore: real("potential_score"),
  physicalScore: real("physical_score"),
  confidenceScore: real("confidence_score"),
  flags: json("flags").$type<string[]>(),
  rankOverall: integer("rank_overall"),
  rankPosition: integer("rank_position"),
  rankOverridePosition: integer("rank_override_position"),
  rankLocked: boolean("rank_locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  overallScore: true,
  positionScore: true,
  potentialScore: true,
  physicalScore: true,
  confidenceScore: true,
  flags: true,
  rankOverall: true,
  rankPosition: true,
  rankOverridePosition: true,
});

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
