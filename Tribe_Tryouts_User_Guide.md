# Tribe Tryouts 2026–2027
## Coach & Staff User Guide

> **Note on videos:** This guide uses screenshots for every step. Screen-recording videos are not currently included, but every workflow is fully described with step-by-step instructions.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started — Importing Players](#2-getting-started--importing-players)
3. [Dashboard](#3-dashboard)
4. [Player List](#4-player-list)
5. [Evaluating Players](#5-evaluating-players)
6. [Rankings](#6-rankings)
7. [Roster Builder](#7-roster-builder)
8. [Live Draft](#8-live-draft)
9. [Tips & Tricks](#9-tips--tricks)

---

## 1. Overview

**Tribe Tryouts 2026–2027** is a web app designed for iPad and laptop use during club volleyball tryouts. It lets you:

- Import your registration list from Google Sheets or a CSV file
- Evaluate every player on 13 skills (8 universal + 5 position-specific), scored 1–10
- View live rankings sorted by overall, position fit, or physical potential
- Build a 12-player suggested roster automatically
- Run a multi-team live draft with real-time pick tracking and wishlists

The app is accessed through a web browser — no installation needed. Open it on any iPad, laptop, or phone.

---

## 2. Getting Started — Importing Players

**Before tryouts begin**, load your registration list so players are ready to be checked in and evaluated.

### Option A — Google Sheets (Recommended)

![Import Players screen](screenshots/import.jpg)

1. Open **Import CSV** in the left sidebar.
2. In the **Google Sheets Sync** section (shown as "Connected"), paste your Google Sheet URL or ID.
3. Optionally enter a tab name (leave blank to use the first sheet).
4. Click **Sync Now**.

**Required columns in your sheet:**

| Column | Required |
|---|---|
| `jerseyNumber` | ✅ |
| `name` | ✅ |
| `position` | ✅ (`Setter`, `OutsideHitter`, `MiddleBlocker`, `Opposite`, `Libero`) |
| `checkedIn` | Optional (true/false) |
| `height` | Optional (inches) |
| `standingReachInches` | Optional |
| `verticalJump` | Optional (inches) |

> **Important:** Jersey number is the unique key. Re-importing the same jersey number updates that player's info — it does not create a duplicate. Evaluation scores are never overwritten by an import.

### Option B — CSV Paste

1. Scroll down on the Import page to the **CSV Import** section.
2. Paste your CSV text or upload a `.csv` file.
3. Click **Import**.

---

## 3. Dashboard

![Dashboard](screenshots/dashboard.jpg)

The Dashboard is your at-a-glance command center during tryouts.

| Card | What it shows |
|---|---|
| **Total Players** | Everyone registered |
| **Checked In** | Players currently in the gym (highlighted orange when more than half) |
| **Evaluated** | Players with at least one score recorded |
| **Missing Measurements** | Players without height, reach, or vertical — needs to be filled before rankings are meaningful |

**By Position** bar chart shows how many players are in each position group.

**Quick Actions** at the right let you jump directly to Player List, Rankings, Roster Builder, or Import.

**Sync Status** (top right) — shows whether your Google Sheets data is current. Click **Refresh Now** to pull the latest from your sheet at any time.

---

## 4. Player List

![Player List](screenshots/players.jpg)

This is where you manage and navigate to all players.

### Filtering

- **Position tabs** across the top filter the list to one position: Outside Hitter, Middle Blocker, Opposite, Setter, or Libero.
- **Search bar** (top right) filters by player name or jersey number in real time.

### Reading the table

| Column | Meaning |
|---|---|
| **#** | Jersey number |
| **Name** | Player name — tap to start evaluating immediately |
| **Position** | Color-coded position badge |
| **Status** | Green "Checked In" or grey "Not Here" |
| **Measurements** | Height / Reach / Vertical, or a red "Missing" badge |
| **Roster** | Shows if they're on the current saved roster |
| **Action** | Hover/tap a row to reveal **Eval** and **Profile** buttons |

### Starting an Eval Session

See [Section 5](#5-evaluating-players) for full details. Quick reference:

- **Tap any player's name** → starts an eval session beginning at that player, continuing through the rest of the list in order.
- **"Eval [Position] (N)" button** (right side of position tabs) → evaluates every player in the current position/filter.
- **"Eval Session: Checked-In" button** (top right) → evaluates only checked-in players.
- **"Eval Session: All" button** (top right) → evaluates all players in the current view.

---

## 5. Evaluating Players

![Evaluation Screen](screenshots/evaluate.jpg)

The evaluation screen scores a player on 1–10 for each skill. **Scores save automatically the instant you tap a number** — there is no Save button.

### Skills evaluated

**Universal Skills (all positions)**
Serving · Passing · Defense · Volleyball IQ · Communication · Coachability · Competitiveness · Consistency

**Position Skills** (shown on the second tab, specific to each position)
- Setter: Hands, Location, Decision-making, Tempo, Leadership
- Outside Hitter: Serve receive, Attacking, Defense, Transition, All-around value
- Middle Blocker: Blocking, Lateral movement, Quick attack, Footwork, Court awareness
- Opposite: Attacking, Blocking, Serving, Back-row value, Physical upside
- Libero: Passing, Defense, Reading hitters, Serve receive, Communication

### Color coding
- **Red (1–2)** · **Orange (3–4)** · **Yellow (5–6)** · **Lime (7)** · **Green (8–9)** · **Emerald (10)**

Each skill row shows a ✓ checkmark once a score is saved.

### Queue / Session Mode

When you start an Eval Session from the Players page, a **yellow banner** appears at the top of the eval screen:

```
⚡ Eval Session: Checked-In · Outside Hitter   3 / 13  [====   ]  ← Prev | Next → | ✕
```

- **Progress bar** shows how far through the session you are.
- **← Prev** goes back to the previous player.
- **Next →** advances to the next player. Turns green with a ✓ when all skills for the current player are scored.
- **✕** ends the session and returns to the Players list.
- A large **"Next Player →"** button also appears in the player header for easy iPad thumb access.

> **Tip:** Use "Eval Setter (3)" to evaluate all setters back-to-back, then switch to the next position. This is the fastest workflow for large tryouts.

---

## 6. Rankings

![Rankings](screenshots/rankings.jpg)

Rankings are computed automatically every time you save an evaluation score. You never need to manually refresh.

### Sorting options (top right)

| Sort | Description |
|---|---|
| **Overall Score** | Weighted average of all skills |
| **Position Score** | How well they fit their assigned position |
| **Potential** | Athleticism + physical measurement bonus (height > 6', vertical > 28") |
| **Physical** | Raw athletic scores |
| **Height / Vert** | Physical measurements |
| **Jersey** | Alphabetical by number |

Toggle **Asc / Desc** to flip the order.

### Reading a ranking row

- **Rank number** (left, in color) — their current position
- **Jersey #** and **Name** — player identity
- **Position badge** — color-coded
- **Score columns** — color-coded green/yellow/red
- **Badges** — "Consistent Performer", "Roster Lock Candidate", etc.
- **Lock** button (right) — pins the player to their current rank so re-sorting doesn't move them

### Greyed-out rows

Players already on the active saved roster appear greyed out so you can focus on unrostered players.

---

## 7. Roster Builder

![Roster Builder](screenshots/roster.jpg)

The Roster Builder automatically selects the best 12-player roster based on evaluation scores and position balance.

**Default slots:**
- 2 Setters
- 3 Outside Hitters
- 3 Middle Blockers
- 2 Opposites
- 2 Liberos/DS

### Using the Roster Builder

1. Click **Roster** in the sidebar.
2. The 12-player roster is generated automatically. Each position group shows the top-scoring players for that slot.
3. Click **Regenerate** to recalculate (useful after entering new scores).
4. Click **Save Roster** to lock in the current roster — it will appear in the Rankings and Players pages as well.

### Roster Explanation

Scroll down below the roster grid to see an AI-generated plain-English explanation of why each player was selected or excluded, based on their scores and physical measurements.

---

## 8. Live Draft

![Live Draft](screenshots/draft.jpg)

Live Draft is used when multiple coaches/teams are selecting players simultaneously — for example, a club with multiple travel teams running a tryout together.

### Setup

1. Click **Live Draft** in the sidebar.
2. Click **+ Add Coach** to add each team/coach. Enter the coach's name and team name.
   - Optionally set a **Draft Priority** — which positions to target first (e.g., OH → MB → S). The app will highlight matching players with a ⭐ Priority badge.
3. Or click **Import Coaches** to bulk-load coaches from a CSV (`coachName`, `teamName` columns).

### Running the draft

1. **Select a team** from the left sidebar — this activates the draft board for that team.
2. The center panel shows two tabs:
   - **Player Pool** — all unclaimed players
   - **My Team** — players already claimed by this team

**In Player Pool:**
- Filter by position (S / OH / MB / OPP / L tabs) or search by name/jersey
- Players matching the coach's priority positions show an amber **⭐ Priority** badge
- Players that other teams have wishlisted show a red **"N teams want"** badge
- Tap the **♥ heart** to add a player to your wishlist (without claiming them yet)
- Tap **+ Claim** or the player card to claim the player for your team — they immediately disappear from the pool for all other coaches

**In My Team:**
- See your claimed players in a grid
- Tap the **🔒 lock icon** to lock a player to your team — this also automatically removes that player from all other coaches' wishlists
- Locked players cannot be accidentally released (the release button is hidden)
- Use **Export CSV** to download your roster as a spreadsheet
- Use **Email Roster** to open a pre-filled email with your full team list

### Multi-device use

The draft auto-refreshes every 5 seconds. Each coach can have the app open on their own device and select a team — they will see picks from other coaches appear in real time.

---

## 9. Tips & Tricks

### Before Tryouts
- Import your full registration list from Google Sheets the night before.
- Verify all jersey numbers are unique and positions are spelled correctly (`OutsideHitter` not `Outside Hitter`).
- Add coach/team entries in Live Draft if running a multi-team draft.

### During Tryouts (Check-In)
- Update your Google Sheet's `checkedIn` column to `true` as players arrive, then click **Refresh Now** on the Dashboard.
- Use the "Checked In" filter in Eval Session to only see players who are actually present.

### During Evaluations
- Start an **Eval Session** by position group — evaluate all Setters together, then Outside Hitters, etc.
- You don't need to score every skill for every player. Any scores you enter are saved immediately and contribute to the rankings.
- **Missing measurements** (height, reach, vertical) significantly reduce a player's Potential score — try to collect these before or during tryouts.

### During Draft
- Each coach should open the app on their own device (phone, iPad, or laptop).
- Use the **Wishlist** to note players you want before it's your turn — if another team locks that player, they're auto-removed from your wishlist.
- Lock players you're certain about to protect them from accidental release.

### Scores & Calculations
- **Overall Score** = weighted average of all skill scores
- **Position Score** = average of position-specific skill scores
- **Potential Score** = athleticism skills + bonus for height > 6'0" and vertical > 28"
- All three scores update the instant you tap a number on the eval screen — no manual save needed.

---

---

## Credits

**Developed by Giancarlos Hurtado**

Web application design, development, and documentation — Tribe Tryouts 2026–2027.

*Built for Tribe Volleyball Club coaching staff.*
