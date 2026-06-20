import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const clubsTable = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Club = typeof clubsTable.$inferSelect;
export type NewClub = typeof clubsTable.$inferInsert;
