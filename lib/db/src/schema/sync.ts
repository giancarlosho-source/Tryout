import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { clubsTable } from "./clubs";

export const syncLogsTable = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull().references(() => clubsTable.id),
  status: text("status").notNull().default("success"),
  playersUpdated: integer("players_updated").notNull().default(0),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sync_logs_club_id_idx").on(t.clubId)]);

export type SyncLog = typeof syncLogsTable.$inferSelect;
