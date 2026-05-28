import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const syncLogsTable = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("success"),
  playersUpdated: integer("players_updated").notNull().default(0),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SyncLog = typeof syncLogsTable.$inferSelect;
