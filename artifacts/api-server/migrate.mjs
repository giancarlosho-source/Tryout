// Runs DB migrations before the server starts (used in Railway/production)
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

console.log("Running database migrations...");
try {
  await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });
  console.log("Drizzle migrations complete.");
} catch (err) {
  console.warn("Drizzle migrate warning (continuing):", err.message);
}

// Safety net: ensure every column exists regardless of migration tracker state.
// These are all idempotent (IF NOT EXISTS) so they're safe to run every deploy.
const safetyAlters = [
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS logo_url text`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS primary_color text`,
  // clubs table additions
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS plan text`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS max_coaches integer`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS max_players integer`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS max_events integer`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS slug text`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS email_verified_at timestamptz`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stripe_customer_id text`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stripe_subscription_id text`,
  `ALTER TABLE clubs ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz`,
  `UPDATE clubs SET slug = regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') WHERE slug IS NULL OR slug = ''`,
  // club_id on all tenant tables
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS club_id integer NOT NULL DEFAULT 1 REFERENCES clubs(id)`,
  `ALTER TABLE coaches ADD COLUMN IF NOT EXISTS club_id integer NOT NULL DEFAULT 1 REFERENCES clubs(id)`,
  `ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS club_id integer NOT NULL DEFAULT 1 REFERENCES clubs(id)`,
  `ALTER TABLE coach_notes ADD COLUMN IF NOT EXISTS club_id integer NOT NULL DEFAULT 1 REFERENCES clubs(id)`,
  `ALTER TABLE rosters ADD COLUMN IF NOT EXISTS club_id integer NOT NULL DEFAULT 1 REFERENCES clubs(id)`,
  `ALTER TABLE staff ADD COLUMN IF NOT EXISTS club_id integer NOT NULL DEFAULT 1 REFERENCES clubs(id)`,
  `ALTER TABLE settings ADD COLUMN IF NOT EXISTS club_id integer NOT NULL DEFAULT 1 REFERENCES clubs(id)`,
  `ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS club_id integer NOT NULL DEFAULT 1 REFERENCES clubs(id)`,
  // club_users table for multiple admins per club
  `CREATE TABLE IF NOT EXISTS club_users (
    id serial PRIMARY KEY,
    club_id integer NOT NULL REFERENCES clubs(id),
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

for (const sql of safetyAlters) {
  try {
    await pool.query(sql);
    console.log("OK:", sql);
  } catch (err) {
    console.error("FAILED:", sql, err.message);
    process.exit(1);
  }
}

// Fix settings unique constraint
try {
  await pool.query(`ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_unique`);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_club_id_key_unique')
      THEN ALTER TABLE settings ADD CONSTRAINT settings_club_id_key_unique UNIQUE (club_id, key);
      END IF;
    END $$
  `);
} catch (err) {
  console.warn("Settings constraint update:", err.message);
}

console.log("Schema safety checks complete.");
await pool.end();
