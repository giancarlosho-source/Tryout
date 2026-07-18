CREATE INDEX IF NOT EXISTS "players_club_id_idx" ON "players" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluations_club_id_idx" ON "evaluations" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evaluations_player_id_idx" ON "evaluations" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roster_players_roster_id_idx" ON "roster_players" USING btree ("roster_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rosters_club_id_idx" ON "rosters" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_notes_club_id_idx" ON "coach_notes" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_notes_player_id_idx" ON "coach_notes" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_logs_club_id_idx" ON "sync_logs" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_must_have_player_id_idx" ON "coach_must_have" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_wishlist_player_id_idx" ON "coach_wishlist" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coaches_club_id_idx" ON "coaches" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_club_id_idx" ON "staff" USING btree ("club_id");
