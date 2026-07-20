import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db, playersTable, clubsTable } from "@workspace/db";
import { broadcast } from "../events";
import { recomputeAllScores } from "../scoring";

const router: IRouter = Router();

const VALID_POSITIONS = ["Setter", "OutsideHitter", "MiddleBlocker", "Opposite", "Libero", "Undecided"] as const;
type Position = typeof VALID_POSITIONS[number];

const AGE_GROUPS = ["10U", "11U", "12U", "13U", "14U", "15U", "16U", "17U", "18U"];

function normalizeAge(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toUpperCase().replace(/\s/g, "");
  const num = s.endsWith("U") ? s.slice(0, -1) : s;
  if (!/^\d+$/.test(num)) return null;
  return `${num}U`;
}

function buildRegistrationHtml(opts: { clubName: string; primaryColor: string; logoUrl?: string | null; registrationToken: string }) {
  const { clubName, primaryColor, logoUrl, registrationToken } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TryoutDesk – Athlete Registration</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f7;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 24px 16px 48px;
    }
    .card {
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      padding: 32px 28px;
      width: 100%;
      max-width: 440px;
    }
    .logo { text-align: center; margin-bottom: 20px; }
    .logo h1 { font-size: 22px; font-weight: 900; color: ${primaryColor}; letter-spacing: -0.5px; }
    .logo p { font-size: 13px; color: #888; margin-top: 3px; }
    .divider { border: none; border-top: 1px solid #eee; margin: 18px 0; }
    label { display: block; font-size: 13px; font-weight: 600; color: #444; margin-bottom: 5px; }
    .required { color: ${primaryColor}; }
    input, select {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #ddd;
      border-radius: 10px;
      font-size: 16px;
      background: #fafafa;
      color: #111;
      outline: none;
      transition: border-color 0.15s;
      margin-bottom: 14px;
      appearance: none;
      -webkit-appearance: none;
    }
    input:focus, select:focus { border-color: ${primaryColor}; background: #fff; }
    .row { display: flex; gap: 12px; }
    .row > div { flex: 1; }
    .hint { font-size: 12px; color: #999; margin-top: -10px; margin-bottom: 14px; }
    button {
      width: 100%;
      padding: 14px;
      background: ${primaryColor};
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 6px;
      transition: opacity 0.15s;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .success {
      display: none;
      text-align: center;
      padding: 28px 16px;
    }
    .success .check { font-size: 56px; margin-bottom: 12px; }
    .success h2 { font-size: 22px; font-weight: 800; color: #1a7a1a; }
    .success p { color: #555; margin-top: 8px; font-size: 15px; }
    .error-msg { color: #c00; font-size: 13px; margin-top: -8px; margin-bottom: 12px; display: none; }
    select option { font-size: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      ${logoUrl ? `<img src="${logoUrl}" alt="${clubName}" style="height:56px;object-fit:contain;margin-bottom:8px;" />` : ""}
      <h1>${clubName}</h1>
      <p>Tryout Registration</p>
    </div>
    <hr class="divider" />

    <div id="form-wrap">
      <form id="reg-form">
        <label>Full Name <span class="required">*</span></label>
        <input type="text" name="name" placeholder="First Last" required autocomplete="name" />

        <label>Jersey Number <span class="required">*</span></label>
        <input type="text" name="jerseyNumber" placeholder="e.g. 21" required inputmode="numeric" />

        <label>Primary Position <span class="required">*</span></label>
        <select name="position" required>
          <option value="" disabled selected>Select position…</option>
          <option value="Setter">Setter</option>
          <option value="OutsideHitter">Outside Hitter</option>
          <option value="MiddleBlocker">Middle Blocker</option>
          <option value="Opposite">Opposite</option>
          <option value="Libero">Libero / DS</option>
          <option value="Undecided">Undecided</option>
        </select>

        <label>Age Group</label>
        <select name="age">
          <option value="">Select age group…</option>
          ${AGE_GROUPS.map(g => `<option value="${g}">${g}</option>`).join("\n          ")}
        </select>

        <div class="error-msg" id="error-msg"></div>
        <button type="submit" id="submit-btn">Register for Tryout</button>
      </form>
    </div>

    <div class="success" id="success">
      <div class="check">✅</div>
      <h2>You're registered!</h2>
      <p id="success-msg">Welcome to TryoutDesk.<br/>See you on the court!</p>
    </div>
  </div>

  <script>
    document.getElementById('reg-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const errEl = document.getElementById('error-msg');
      btn.disabled = true;
      btn.textContent = 'Submitting…';
      errEl.style.display = 'none';

      const data = {
        name: this.name.value.trim(),
        jerseyNumber: this.jerseyNumber.value.trim(),
        position: this.position.value,
        age: this.age.value || undefined,
        registrationToken: ${JSON.stringify(registrationToken)},
      };

      try {
        const res = await fetch('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Registration failed.');
        document.getElementById('form-wrap').style.display = 'none';
        document.getElementById('success').style.display = 'block';
        document.getElementById('success-msg').textContent =
          'Welcome, ' + json.name + '! Jersey #' + json.jerseyNumber + ' is all set.';
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Register for Tryout';
      }
    });
  </script>
</body>
</html>`;
}

router.get("/register", async (req, res): Promise<void> => {
  const slugParam = req.query["club"] ? String(req.query["club"]) : null;

  if (!slugParam) {
    res.status(400).send("<h2>Invalid registration link. Please scan your club's QR code.</h2>");
    return;
  }

  const club = await db
    .select()
    .from(clubsTable)
    .where(eq(clubsTable.slug, slugParam))
    .limit(1)
    .then((r) => r[0]);

  if (!club) {
    res.status(404).send("<h2>Club not found. Please scan your club's QR code.</h2>");
    return;
  }

  // Issue a short-lived signed token so the POST handler can trust the clubId
  const registrationToken = jwt.sign(
    { clubId: club.id },
    process.env["JWT_SECRET"]!,
    { expiresIn: "4h" },
  );

  res.setHeader("Content-Type", "text/html");
  res.send(buildRegistrationHtml({
    clubName: club.name,
    primaryColor: club.primaryColor ?? "#0f172a",
    logoUrl: club.logoUrl ?? null,
    registrationToken,
  }));
});

router.post("/register", async (req, res): Promise<void> => {
  const { jerseyNumber, name, position, age, heightInches, standingReachInches, verticalJumpInches, registrationToken } = req.body ?? {};

  if (!registrationToken) {
    res.status(400).json({ error: "Invalid registration link. Please scan the QR code again." });
    return;
  }

  let clubId: number;
  try {
    const payload = jwt.verify(registrationToken, process.env["JWT_SECRET"]!) as { clubId: number };
    clubId = payload.clubId;
  } catch {
    res.status(400).json({ error: "Registration link has expired. Please scan the QR code again." });
    return;
  }

  if (!name || !VALID_POSITIONS.includes(position)) {
    res.status(400).json({ error: "Please fill in all required fields." });
    return;
  }

  await db.insert(playersTable).values({
    clubId,
    jerseyNumber: jerseyNumber || null,
    name,
    position,
    checkedIn: false,
    age: normalizeAge(age),
    heightInches: heightInches ?? null,
    standingReachInches: standingReachInches ?? null,
    verticalJumpInches: verticalJumpInches ?? null,
  });

  await recomputeAllScores();
  broadcast("players:changed", req.clubId);

  res.json({ ok: true, name, jerseyNumber: jerseyNumber || null });
});

export default router;
