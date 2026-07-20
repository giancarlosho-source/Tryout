import * as Sentry from "@sentry/node";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { requireAuth } from "./middleware/auth";
import { requireActiveSubscription } from "./middleware/subscription";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Restrict CORS to known frontend origins only
const ALLOWED_ORIGINS = new Set([
  "https://app.tryoutdesk.com",
  "https://tryoutdesk.com",
  "https://www.tryoutdesk.com",
  // allow local dev
  "http://localhost:5173",
  "http://localhost:4173",
]);
app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (mobile apps, curl, Stripe webhooks)
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));

// In-memory rate limiter — tracks attempts per IP per route key
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, maxAttempts: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
    const storeKey = `${key}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(storeKey);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(storeKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > maxAttempts) {
      res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
      return;
    }
    next();
  };
}

// Stripe webhook needs raw body — must be before express.json()
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Serve static assets (logo, etc) — but NOT register.html (handled dynamically by register route)
const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir, { index: false }));

// Serve player photos
const uploadsDir = path.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

const PUBLIC_PATHS = new Set(["/billing/webhook", "/billing/signup-trial", "/cron/trial-reminders"]);
const PUBLIC_PREFIXES = ["/staff/public/", "/players/public/", "/rankings/public/", "/events/public/"];

// Rate limit auth endpoints: 10 attempts per 15 minutes per IP
app.use("/api/auth/login",         rateLimit("login",          10, 15 * 60 * 1000));
app.use("/api/auth/admin-login",   rateLimit("admin-login",    5,  15 * 60 * 1000));
app.use("/api/auth/forgot-password", rateLimit("forgot-pw",   5,  15 * 60 * 1000));

// Rate limit player self-registration: 40 submissions per IP per hour
app.use("/api/register", rateLimit("register", 40, 60 * 60 * 1000));

app.use("/api", (req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) return next();
  requireAuth(req, res, next);
});
app.use("/api", (req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (PUBLIC_PREFIXES.some((p) => req.path.startsWith(p))) return next();
  requireActiveSubscription(req, res, next);
});
app.use("/api", router);

// Sentry error handler must come after all routes
if (process.env["SENTRY_DSN"]) {
  Sentry.setupExpressErrorHandler(app);
}

export { rateLimit };
export default app;
