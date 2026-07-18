import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Routes that don't require a JWT (paths are relative to /api mount point)
const PUBLIC_PATHS = new Set([
  "/auth/login",
  "/auth/status",
  "/auth/logo",
  "/auth/club",
  "/auth/forgot-password",
  "/auth/verify-email",
  "/auth/admin-login",
  "/healthz",
  "/server-info",
  "/events",
]);

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Allow public routes and static assets
  if (PUBLIC_PATHS.has(req.path) || req.path.startsWith("/uploads/")) {
    next();
    return;
  }

  const secret = process.env["JWT_SECRET"]!;

  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), secret) as { clubId: number };
    (req as Request & { clubId: number }).clubId = payload.clubId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
