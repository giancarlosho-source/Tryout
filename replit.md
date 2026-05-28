# TryoutPro — Volleyball Tryout Manager

A responsive web app for club volleyball tryouts. Coaches evaluate players, track measurements, rank by position and overall, and build 12-player rosters with AI-assisted summaries.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/tryout-app run dev` — run the frontend (port 19107)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, wouter, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — DB tables: players, evaluations, rosters, roster_players, coach_notes, sync_logs
- `artifacts/api-server/src/routes/` — Express route handlers (players, evaluations, rankings, rosters, notes, sync, ai)
- `artifacts/tryout-app/src/` — React frontend

## Architecture decisions

- Google Sheets sync is designed as CSV import for MVP; sync logs track all import events
- Evaluation scores (1–10) are stored in a separate table and NEVER overwritten by CSV import — only player info fields are updated on sync
- Overall, position, and potential scores are recomputed server-side whenever evaluations are saved
- Potential score factors in athleticism skills + physical measurement bonus (height > 6ft, vertical > 28")
- AI summaries are rule-based (no LLM dependency) — derived from eval data patterns

## Product

- **Dashboard** — live stats, sync status bar, Refresh Now button, position breakdown
- **Player List** — sortable/filterable table with position tabs, missing-measurement highlights, check-in status
- **Player Profile** — full detail, all skill scores, coach notes, AI summary generation
- **Evaluation Screen** — fast 1–10 scoring interface, large tap targets for iPad
- **Rankings** — sortable by overall/position/potential/height/vertical/jersey; lock toggle; override
- **Roster Builder** — 12-player suggested roster, bubble players panel, missing position alerts
- **CSV Import** — paste or upload CSV with auto field mapping

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after spec changes before touching backend or frontend
- CSV import uses jersey number as the unique key — duplicate jersey numbers get updated, not duplicated
- Player scores (overall/position/potential) are columns on the players table, recomputed on every eval upsert/update
- `pnpm --filter @workspace/db run push` required after any schema changes before the API server will work

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
