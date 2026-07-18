import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";
import { clubsTable } from "./clubs";

export const evaluationsTable = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull().references(() => clubsTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  skill: text("skill").notNull(),
  score: real("score").notNull(),
  notes: text("notes"),
  coachName: text("coach_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index("evaluations_club_id_idx").on(t.clubId), index("evaluations_player_id_idx").on(t.playerId)]);

export const insertEvaluationSchema = createInsertSchema(evaluationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type Evaluation = typeof evaluationsTable.$inferSelect;
