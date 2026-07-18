import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable, clubsTable } from "@workspace/db";

const router: IRouter = Router();


async function upsertSetting(clubId: number, key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ clubId, key, value })
    .onConflictDoUpdate({ target: [settingsTable.clubId, settingsTable.key], set: { value } });
}

router.get("/settings", async (req, res) => {
  const clubId = req.clubId;
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.clubId, clubId));
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json(settings);
});

router.put("/settings", async (req, res) => {
  const clubId = req.clubId;
  const updates = req.body as Record<string, string>;

  // Trial limit: 1 event. Enforce when session.event is being set.
  if ("session.event" in updates) {
    const newEventName = updates["session.event"]?.trim();

    if (newEventName) {
      const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));

      if (club?.status === "trial") {
        // Load the set of event names this club has ever used during trial
        const rows = await db.select().from(settingsTable).where(eq(settingsTable.clubId, clubId));
        const settingsMap: Record<string, string> = {};
        for (const r of rows) settingsMap[r.key] = r.value;

        const usedEvents: string[] = settingsMap["trial.events_used"]
          ? JSON.parse(settingsMap["trial.events_used"])
          : [];

        const isNewEvent = !usedEvents.map(e => e.toLowerCase()).includes(newEventName.toLowerCase());

        if (isNewEvent && usedEvents.length >= 1) {
          res.status(403).json({
            error: "Trial accounts are limited to 1 event. Subscribe to run unlimited events.",
            code: "TRIAL_EVENT_LIMIT",
          });
          return;
        }

        if (isNewEvent) {
          // Record this event name as used
          await upsertSetting(clubId, "trial.events_used", JSON.stringify([...usedEvents, newEventName]));
        }
      }
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    await upsertSetting(clubId, key, value);
  }
  res.json({ ok: true });
});

export default router;
