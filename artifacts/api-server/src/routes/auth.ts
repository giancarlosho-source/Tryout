import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/auth/verify", (req, res): void => {
  const { password } = req.body ?? {};
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (!adminPassword) {
    // No password configured — open access
    res.json({ ok: true });
    return;
  }

  if (password === adminPassword) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "Incorrect password" });
  }
});

router.get("/auth/required", (_req, res): void => {
  res.json({ required: !!process.env["ADMIN_PASSWORD"] });
});

export default router;
