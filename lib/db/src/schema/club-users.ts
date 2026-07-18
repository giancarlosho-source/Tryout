import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { clubsTable } from "./clubs";

export const clubUsersTable = pgTable("club_users", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull().references(() => clubsTable.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClubUser = typeof clubUsersTable.$inferSelect;
export type NewClubUser = typeof clubUsersTable.$inferInsert;
