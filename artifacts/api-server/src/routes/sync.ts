import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, syncLogsTable, playersTable } from "@workspace/db";
import { TriggerSyncBody } from "@workspace/api-zod";
import { recomputeAllScores } from "../scoring";

// Extract spreadsheet ID from various Google Sheets URL formats
function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Extract the gid (numeric sheet tab ID) from a Google Sheets URL
function extractGid(input: string): string | null {
  const match = input.match(/[#&?]gid=(\d+)/);
  return match ? match[1] : null;
}

const POSITION_MAP: Record<string, string> = {
  setter: "Setter", s: "Setter",
  "outside hitter": "OutsideHitter", oh: "OutsideHitter", outside: "OutsideHitter",
  "middle blocker": "MiddleBlocker", mb: "MiddleBlocker", middle: "MiddleBlocker",
  opposite: "Opposite", opp: "Opposite", rs: "Opposite",
  libero: "Libero", l: "Libero", ds: "Libero", "libero/ds": "Libero", "ds/l": "Libero",
  pin: "OutsideHitter", "pin/ds": "OutsideHitter/Libero", "pin/mb": "OutsideHitter/MiddleBlocker", "pin/setter": "Opposite",
  undecided: "Undecided", tbd: "Undecided", unknown: "Undecided",
};

const router: IRouter = Router();

router.get("/sync/status", async (_req, res): Promise<void> => {
  const [latest] = await db
    .select()
    .from(syncLogsTable)
    .orderBy(desc(syncLogsTable.createdAt))
    .limit(1);

  if (!latest) {
    res.json({
      lastSyncAt: null,
      status: "idle",
      playersUpdated: 0,
      message: null,
    });
    return;
  }

  res.json({
    lastSyncAt: latest.createdAt,
    status: latest.status,
    playersUpdated: latest.playersUpdated,
    message: latest.message,
  });
});

router.post("/sync/trigger", async (req, res): Promise<void> => {
  const parsed = TriggerSyncBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [log] = await db
    .insert(syncLogsTable)
    .values({
      status: "success",
      playersUpdated: 0,
      message: `Manual sync triggered by coach at ${new Date().toLocaleTimeString()}`,
    })
    .returning();

  res.json({
    lastSyncAt: log.createdAt,
    status: log.status,
    playersUpdated: log.playersUpdated,
    message: log.message,
  });
});

function parseDelimited(text: string): string[][] {
  const cleaned = text.replace(/^﻿/, "").trim();
  const lines = cleaned.split(/\r?\n/);
  const firstLine = lines[0] ?? "";
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const delim = tabCount > commaCount ? "\t" : ",";

  return lines.map((line) => {
    const row: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === delim && !inQuote) { row.push(cur); cur = ""; }
      else { cur += ch; }
    }
    row.push(cur);
    return row;
  });
}

async function fetchSheetAsCsv(sheetId: string, sheetName?: string, gid?: string): Promise<string[][] | null> {
  const params = new URLSearchParams({ format: "csv", id: sheetId });
  if (gid) {
    params.set("gid", gid);
  } else if (sheetName) {
    params.set("sheet", sheetName);
  }
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?${params}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) return null;
  const text = await res.text();
  if (text.trimStart().startsWith("<!")) return null;
  return parseDelimited(text);
}

// Fetch tab names for a public Google Sheet by parsing the HTML page
async function fetchSheetTabs(sheetId: string): Promise<string[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Google embeds sheet names in a JS bootstrap payload like: "sheet-tab-0" ... or in aria-labels
    // Pattern: ["SheetName",null,sheetId,...] in the page data
    const tabs: string[] = [];
    // Match tab names from the gid/name pattern Google uses in the HTML
    const re = /\["([^"]+)",null,\d+,\d+,null,null,null,1\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      tabs.push(m[1]);
    }
    if (tabs.length > 0) return tabs;
    // Fallback: look for aria-label="SheetName" on sheet tab elements
    const re2 = /aria-label="([^"]+)"\s+[^>]*sheet-tab/g;
    while ((m = re2.exec(html)) !== null) {
      tabs.push(m[1]);
    }
    return tabs;
  } catch {
    return [];
  }
}

router.get("/sync/sheets/tabs", async (req, res): Promise<void> => {
  const { sheetUrl } = req.query as { sheetUrl?: string };
  if (!sheetUrl) {
    res.status(400).json({ error: "sheetUrl is required" });
    return;
  }
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    res.status(400).json({ error: "Could not extract a spreadsheet ID from the provided URL" });
    return;
  }

  const gid = extractGid(sheetUrl);
  const tabs = await fetchSheetTabs(sheetId);
  res.json({ tabs, gid });
});

router.post("/sync/sheets", async (req, res): Promise<void> => {
  const { sheetUrl, sheetName, gid: bodyGid, checkedInOnly } = req.body as { sheetUrl?: string; sheetName?: string; gid?: string; checkedInOnly?: boolean };

  if (!sheetUrl) {
    res.status(400).json({ error: "sheetUrl is required" });
    return;
  }

  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    res.status(400).json({ error: "Could not extract a spreadsheet ID from the provided URL" });
    return;
  }

  // Prefer gid from URL itself, then from body, then fall back to sheet name
  const urlGid = extractGid(sheetUrl);
  const gid = urlGid || bodyGid || undefined;

  let values: string[][];

  try {
    const csvValues = await fetchSheetAsCsv(sheetId, gid ? undefined : sheetName, gid);
    if (!csvValues) {
      res.status(403).json({
        error:
          'Could not access the spreadsheet. In Google Sheets, click Share → change access to "Anyone with the link" (Viewer), then try again.',
      });
      return;
    }
    values = csvValues;
  } catch (err) {
    req.log.error({ err }, "CSV export fetch failed");
    res.status(502).json({
      error:
        'Could not access the spreadsheet. In Google Sheets, click Share → change access to "Anyone with the link" (Viewer), then try again.',
    });
    return;
  }

  if (values.length < 2) {
    res.json({ imported: 0, updated: 0, errors: ["Sheet must have a header row and at least one data row"] });
    return;
  }

  const headers = values[0].map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "").replace(/^﻿/, "")
  );

  const errors: string[] = [];
  let imported = 0;
  let updated = 0;

  for (let i = 1; i < values.length; i++) {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[i][idx] ?? "").trim(); });

    const jersey = row["jerseynumber"] || row["jersey"] || row["#"] || row["number"] || null;
    const firstName = row["firstname"] || row["first"] || row["fname"] || "";
    const lastName = row["lastname"] || row["last"] || row["lname"] || "";
    const name =
      row["playername"] ||
      row["name"] ||
      (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName);
    const rawPosition = row["position"] || row["position1"] || row["pos"] || null;
    const mappedPosition = rawPosition
      ? (POSITION_MAP[rawPosition.trim().toLowerCase()] ??
         rawPosition.split("/").map((part) => POSITION_MAP[part.trim().toLowerCase()] ?? part.trim()).join("/"))
      : null;

    const isCheckedIn = ["true", "yes", "✓", "x", "1"].includes((row["checkedinstatus"] || row["checkedin"] || row["bc"] || "").toLowerCase());

    // Skip entirely blank rows
    if (!name) {
      if (Object.values(row).some((v) => v)) {
        errors.push(`Row ${i + 1}: Missing player name — skipped`);
      }
      continue;
    }

    // On tryout day: skip players who haven't checked in
    if (checkedInOnly && !isCheckedIn) continue;

    const playerData = {
      jerseyNumber: jersey,
      name,
      position: mappedPosition,
      checkedIn: isCheckedIn,
      heightInches: row["height"] ? parseFloat(row["height"]) || null : null,
      standingReachInches: row["standingreachinches"] || row["reach"] ? parseFloat(row["standingreachinches"] || row["reach"]) || null : null,
      verticalJumpInches: row["verticaljump"] || row["vertical"] ? parseFloat(row["verticaljump"] || row["vertical"]) || null : null,
    };

    try {
      const existing = jersey
        ? await db.select().from(playersTable).where(eq(playersTable.jerseyNumber, jersey))
        : await db.select().from(playersTable).where(eq(playersTable.name, name));
      if (existing.length > 0) {
        await db.update(playersTable).set({
          name: playerData.name,
          position: playerData.position,
          jerseyNumber: playerData.jerseyNumber,
          checkedIn: playerData.checkedIn,
          heightInches: playerData.heightInches,
          standingReachInches: playerData.standingReachInches,
          verticalJumpInches: playerData.verticalJumpInches,
        }).where(eq(playersTable.id, existing[0].id));
        updated++;
      } else {
        await db.insert(playersTable).values(playerData);
        imported++;
      }
    } catch {
      errors.push(`Row ${i + 1}: Failed to upsert player ${name}`);
    }
  }

  if (imported > 0 || updated > 0) {
    await recomputeAllScores();
  }

  await db.insert(syncLogsTable).values({
    status: errors.length > 0 && imported === 0 && updated === 0 ? "error" : "success",
    playersUpdated: imported + updated,
    message: `Google Sheets sync: ${imported} imported, ${updated} updated${errors.length > 0 ? `, ${errors.length} errors` : ""}`,
  });

  res.json({ imported, updated, errors });
});

export default router;
