import { Router, type IRouter } from "express";
import { db, playersTable } from "@workspace/db";
import { broadcast } from "../events";
import { recomputeAllScores } from "../scoring";

const router: IRouter = Router();

const VALID_POSITIONS = ["Setter", "OutsideHitter", "MiddleBlocker", "Opposite", "Libero", "Undecided"] as const;
type Position = typeof VALID_POSITIONS[number];

const REGISTRATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tribe VB – Athlete Registration</title>
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
    .logo h1 { font-size: 22px; font-weight: 900; color: #8B0000; letter-spacing: -0.5px; }
    .logo p { font-size: 13px; color: #888; margin-top: 3px; }
    .divider { border: none; border-top: 1px solid #eee; margin: 18px 0; }
    label { display: block; font-size: 13px; font-weight: 600; color: #444; margin-bottom: 5px; }
    .required { color: #8B0000; }
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
    input:focus, select:focus { border-color: #8B0000; background: #fff; }
    .row { display: flex; gap: 12px; }
    .row > div { flex: 1; }
    .hint { font-size: 12px; color: #999; margin-top: -10px; margin-bottom: 14px; }
    button {
      width: 100%;
      padding: 14px;
      background: #8B0000;
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
      <h1>🏐 Tribe Volleyball</h1>
      <p>2026–2027 Tryout Registration</p>
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

        <label>Age</label>
        <input type="number" name="age" placeholder="e.g. 16" min="10" max="25" inputmode="numeric" />

        <div class="error-msg" id="error-msg"></div>
        <button type="submit" id="submit-btn">Register for Tryout</button>
      </form>
    </div>

    <div class="success" id="success">
      <div class="check">✅</div>
      <h2>You're registered!</h2>
      <p id="success-msg">Welcome to the Tribe tryout.<br/>See you on the court!</p>
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
        age: this.age.value ? parseInt(this.age.value) : undefined,
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

router.get("/register", (_req, res): void => {
  res.setHeader("Content-Type", "text/html");
  res.send(REGISTRATION_HTML);
});

router.post("/register", async (req, res): Promise<void> => {
  const { jerseyNumber, name, position, age, heightInches, standingReachInches, verticalJumpInches } = req.body ?? {};

  if (!name || !VALID_POSITIONS.includes(position)) {
    res.status(400).json({ error: "Please fill in all required fields." });
    return;
  }

  await db.insert(playersTable).values({
    jerseyNumber: jerseyNumber || null,
    name,
    position,
    checkedIn: false,
    age: age ?? null,
    heightInches: heightInches ?? null,
    standingReachInches: standingReachInches ?? null,
    verticalJumpInches: verticalJumpInches ?? null,
  });

  await recomputeAllScores();
  broadcast("players:changed");

  res.json({ ok: true, name });
});

export default router;
