import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reuses the same migrate.mjs script that runs in production (railway.toml
// startCommand), so the test DB schema matches prod exactly instead of
// drifting from a separately-maintained test migration path.
export async function setup(): Promise<void> {
  await execFileAsync("node", [path.join(__dirname, "../../migrate.mjs")], {
    env: process.env,
  });
}
