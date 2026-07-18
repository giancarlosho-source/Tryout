import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { clubsTable } from "./clubs";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull().references(() => clubsTable.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [unique().on(t.clubId, t.key)]);

export type Setting = typeof settingsTable.$inferSelect;
