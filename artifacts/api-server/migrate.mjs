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
await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });
console.log("Migrations complete.");
await pool.end();
