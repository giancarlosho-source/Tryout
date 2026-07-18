-- Add status/plan fields to clubs
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamptz;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "plan" text;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "max_coaches" integer;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "max_players" integer;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "max_events" integer;

-- Add club_id to all tables (existing rows → club 1)
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "club_id" integer NOT NULL DEFAULT 1 REFERENCES clubs(id);
ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "club_id" integer NOT NULL DEFAULT 1 REFERENCES clubs(id);
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "club_id" integer NOT NULL DEFAULT 1 REFERENCES clubs(id);
ALTER TABLE "coach_notes" ADD COLUMN IF NOT EXISTS "club_id" integer NOT NULL DEFAULT 1 REFERENCES clubs(id);
ALTER TABLE "rosters" ADD COLUMN IF NOT EXISTS "club_id" integer NOT NULL DEFAULT 1 REFERENCES clubs(id);
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "club_id" integer NOT NULL DEFAULT 1 REFERENCES clubs(id);
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "club_id" integer NOT NULL DEFAULT 1 REFERENCES clubs(id);
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "club_id" integer NOT NULL DEFAULT 1 REFERENCES clubs(id);

-- Fix settings unique constraint: was (key), now (club_id, key)
ALTER TABLE "settings" DROP CONSTRAINT IF EXISTS "settings_key_unique";
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settings_club_id_key_unique'
  ) THEN
    ALTER TABLE "settings" ADD CONSTRAINT "settings_club_id_key_unique" UNIQUE (club_id, key);
  END IF;
END $$;
