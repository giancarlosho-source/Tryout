import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";
import { clubsTable } from "./clubs";

export const coachNotesTable = pgTable("coach_notes", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull().references(() => clubsTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index("coach_notes_club_id_idx").on(t.clubId), index("coach_notes_player_id_idx").on(t.playerId)]);

export const insertNoteSchema = createInsertSchema(coachNotesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type CoachNote = typeof coachNotesTable.$inferSelect;
