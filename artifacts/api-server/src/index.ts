import * as Sentry from "@sentry/node";

if (process.env["SENTRY_DSN"]) {
  Sentry.init({
    dsn: process.env["SENTRY_DSN"],
    environment: process.env["NODE_ENV"] ?? "production",
    tracesSampleRate: 0.2,
  });
}

import app from "./app";
import { logger } from "./lib/logger";
import { recomputeAllScores } from "./scoring";
import { startScheduler } from "./lib/scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

if (!process.env["JWT_SECRET"]) {
  throw new Error(
    "JWT_SECRET environment variable is required but was not provided.",
  );
}

if (!process.env["CRON_SECRET"]) {
  throw new Error(
    "CRON_SECRET environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startScheduler();

  // Recompute all player scores on startup with the latest scoring engine
  try {
    await recomputeAllScores();
    logger.info("Startup score recomputation complete");
  } catch (e) {
    logger.error({ err: e }, "Startup score recomputation failed");
  }
});
