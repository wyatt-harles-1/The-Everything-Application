# Life Hub — Project Plan & Status

> **Living document.** This is the north star and the current state of the project in one place:
> what we're building, why, what's done, what's left, and what we're working on right now.
>
> **To resume a session:** tell Claude *"read PROJECT.md and let's continue."* Claude updates the
> checklists and the **Current focus** section as work lands, so this file is always the handoff
> point between sessions.

**Last updated:** 2026-05-30

---

## 1. Purpose

Life Hub ("The Everything Application") is a personal life-management system that pulls every
meaningful thing in my life — training, health, habits, goals, schedule, and eventually finances
and more — into one private, queryable place. Data comes from two sources: things I log by hand,
and (later) third-party services that sync automatically (Strava, Cronometer, Apple Health, Plaid).

Everything lands on a single chronological timeline backed by Postgres, so an AI assistant can
reason across all of it ("how did my sleep affect my lifts last month?") instead of each feature
living in its own silo.

## 2. Goals & vision

- **One hub, many modules.** The Life Hub is where the whole ecosystem comes together. Each module
  (lifting, running, health, scheduler, finance…) might *later* run as its own standalone app or
  subdomain — but the hub always owns the cross-cutting features: scheduler/planner, goal tracking,
  and an AI expert with access to all my data across every module.
- **Preserve optionality.** Undecided on whether modules ever ship to other people. So: don't
  extract anything yet, but keep the architecture clean enough that extraction is a mechanical
  move later, not a rewrite.
- **AI that actually knows me.** The end state is an assistant that can read any of my data, make
  changes on my behalf (with approval), and give genuinely useful, personalized coaching — because
  it sees everything, not one slice.

## 3. Architecture — the load-bearing rules

These protect both the AI future and the "modules could become standalone apps" optionality.
Breaking one quietly closes a door later. **Full detail lives in Claude's project memory; the short
version:**

1. **One Supabase project, one schema per domain** (`shared`, `wellness`, `productivity` today;
   `finance`, `knowledge` reserved). Not one database per module — the hub needs cross-domain reads.
2. **`shared.events` is the universal timeline.** Every meaningful occurrence writes a row pointing
   back to its detail table. This is what makes cross-domain AI queries possible.
3. **`shared.goals` owns all goals** across every domain (filtered by `domain`). Modules don't grow
   their own goals tables.
4. **`shared.sources` tags every row's origin** (manual vs. integration vs. import) — metadata, not
   separate tables.
5. **Row Level Security on every table**, scoped to the signed-in user, from day one.
6. **Apps are organizational units, not data boundaries.** Splitting a module into its own app
   changes URLs/deploys, not data contracts.
7. **Server Actions are tool-shaped** — single-purpose, typed in/out, so the AI can call them
   directly.
8. **Every module has a rules table** (e.g. `wellness.lifting_rules`) storing user/agent-defined
   runtime behavior as structured data — the substrate for the AI changing how a module behaves
   without writing code.

**Practical discipline:** schema changes only ever happen via a migration file + `supabase db push`
— never by editing in the Supabase dashboard (that causes drift that's painful to debug). New domain
schemas must also be added to `supabase/config.toml`'s `api.schemas` array.

## 4. Tech stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript, Tailwind
- **Data/Auth:** Supabase (Postgres + Auth), Row Level Security, email OTP sign-in
- **AI:** Vercel AI SDK (`ai` v6) with bring-your-own-key support for Anthropic, OpenAI, Google,
  Mistral, and Groq
- **Tooling:** pnpm, Supabase CLI (migrations via `db push`). Dev runs against the hosted
  Supabase project; Docker is optional, only for the local `supabase start` stack
- **Hosting:** Vercel (auto-deploys on push to `main`), hosted Supabase, Resend for auth email
- **CI:** GitHub Actions runs typecheck → lint → build on every push to `main` (required to merge)

See `README.md` for setup and day-to-day commands.

---

## 5. Feature status

### ✅ Implemented

- **Foundation:** domain schemas, universal events timeline, `sources`, RLS everywhere, deployment
  pipeline (Vercel + hosted Supabase + Resend + CI), email-OTP auth, auth-guarded `(app)` routes.
- **Manual logging:** workouts, lifting sets, cardio, mobility, meals, sleep, body composition,
  mood, medications + dose logs, cycle entries, bloodwork panels + results (with private file
  storage). Mobile-first forms with shared form library.
- **Weightlifting module:** exercise library, workout templates, gym/session mode, PR tracking +
  dashboard, tempo/RIR/bodyweight/per-exercise rest, plate calculator, body-part split, drag-and-drop
  reorder, mesocycle tracking.
- **Scheduler / planner (Phase 4a):** `shared.scheduled_events` with recurring events; today's plan
  surfaces on the dashboard.
- **Habits (Phase 4a):** `shared.habits` with weekly targets + streak computation.
- **Goals UI (Phase 4b):** `shared.goals` with priorities, target metrics, deadlines.
- **Dashboard redesign (Phase 4c):** home page is now a daily briefing — today's plan, training
  block, habits, top goals, quick-log, recent activity.
- **Running module (Phase 4d):** running-specific logging + hub with weekly mileage/pace.
- **Health hub (Phase 4d):** sleep/mood/body/medication overview.
- **AI assistant (Phase 4e — complete):**
  - Multi-provider chat with bring-your-own-key or managed key (`/assistant`, `/assistant/settings`)
  - Read-only tools across domains (summaries, metrics, PRs, mesocycle, module rules)
  - Mutation tools with per-action approval gates
  - Can read **and** patch per-module rules tables (invariant #8)
  - Chat persistence + thread list (`/assistant/threads`)
  - Cross-session assistant memory (`/assistant/memory`)
  - Per-domain "Coach says" advice cards on the module hubs (Phase 4e6)
  - **Master/specialist multi-agent (Phase 4e7):** the master can delegate to four
    `consult_*` coach sub-agents (lifting/running/health/goals) via the agents-as-tools
    pattern. Specialists are read-only domain experts that return a finding plus concrete
    `propose_action` recommendations; the master relays any proposal through the existing
    approve/reject gate, so RLS + human-in-the-loop stay intact. See `src/lib/ai/specialists.ts`.
- **Integrations — Strava (Phase 5 Wave 1):** OAuth connect + on-demand **"Sync now"** at
  `/integrations`. Imports all cardio types (run/ride/swim/walk → workouts + cardio_sessions,
  others → bare workout) onto the universal timeline, tagged to a `provider='strava'` source.
  Tokens stored encrypted in `sources.config` (reuses `encryption.ts` + `AI_SETTINGS_MASTER_KEY`);
  idempotent via a `(source_id, external_id)` unique index. Auto-sync (webhooks/cron) is the next
  wave. Code: `src/lib/integrations/{strava,sources}.ts`, `src/app/api/integrations/strava/*`,
  `src/app/(app)/integrations/*`.
- **Operational lock:** site-wide passcode gate at `/gate` — controlled by the `SITE_PASSCODE`
  env var, custom Life Hub-styled passcode page, HttpOnly + Secure cookie holds a SHA-256 hash
  (cleartext never stored), sits in front of Supabase auth. Toggle on/off by setting or removing
  the env var in Vercel.

### 🔭 Wanted but not started

- **Wellness integrations (Phase 5) — remaining:** Strava **auto-sync** (webhooks or cron; Wave 1
  is manual "Sync now"); Cronometer and Apple Health connectors.
- **Bloodwork module + AI doctor:** tables exist; the module UI and AI interpretation don't.
- **Finance domain + AI financial advisor:** Plaid sync, `finance` schema, advisor agent.
- **Knowledge domain:** reserved, undefined.
- **Mobility module** as a first-class module.
- **Standalone-module extraction:** scope auth cookies to `.projectkosmos.com` and split a module
  into its own subdomain. Deferred until there's a reason to.

### 🧹 Known tech debt / polish

- **Timezone handling.** Several places (dashboard "today" bounds, `coach.ts` `isoToday`, greeting)
  use server-local time. Fine for US use and daily granularity; a TZ-aware pass is deferred.
- ~~**GitHub Actions on Node 20.**~~ ✅ Resolved 2026-05-30 — bumped to `actions/checkout@v5`,
  `actions/setup-node@v5`, `pnpm/action-setup@v6` (all on the node24 action runtime), ahead of
  GitHub's **2026-06-02** deprecation.
- **Deployment hardening:** no separate preview database (previews share prod), no DMARC record,
  no uptime/monitoring on `/api/health`.
- **Coach cards** (Phase 4e6) — code is on prod and the migration is applied to the hosted DB,
  but the cards have **not yet been manually tested in a browser**. Just needs a hub page visit
  while signed in with a provider configured.
- **Preview environment** of the passcode gate isn't set yet — the Vercel CLI looped on the
  "all preview branches" command; add `SITE_PASSCODE` to Preview manually in the Vercel dashboard
  before spinning up any preview branch.

---

## 6. Phase roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: schemas, events, RLS, deploy pipeline | ✅ |
| 1.5 | Deployment wiring | ✅ |
| 2 | Manual logging UI + wellness tables | ✅ |
| 3 | Weightlifting module | ✅ ("good enough for now") |
| **4** | **Base Life Hub features** (current) | ✅ complete |
| · 4a | Scheduler/planner + habits | ✅ |
| · 4b | Personal goals UI | ✅ |
| · 4c | Main dashboard redesign | ✅ |
| · 4d | Module priority pass (running, health) | ✅ |
| · 4e | AI assistant (chat → tools → memory → coach → multi-agent) | ✅ |
| **5** | **Wellness integrations (Strava, Cronometer, Apple Health)** (current) | 🚧 Strava Wave 1 done |
| · 5a | Strava: OAuth connect + manual "Sync now" | ✅ |
| · 5b | Strava auto-sync (webhooks or cron) | ⬜ |
| · 5c | Cronometer, Apple Health connectors | ⬜ |
| 6+ | Bloodwork + AI doctor, Finance + AI advisor, knowledge, extraction | ⬜ |

---

## 7. Current focus — pick up here

**Just landed (this session, 2026-05-30):**
- **Phase 5 Wave 1 — Strava integration (connect + manual sync).** `/integrations` page with
  OAuth connect, "Sync now", and disconnect. New migration `20260530000000_workouts_external_id.sql`
  (idempotency). New `src/lib/integrations/{strava,sources}.ts`, OAuth routes under
  `src/app/api/integrations/strava/`, actions + page under `src/app/(app)/integrations/`. Linked
  from the running hub + dashboard. Typecheck + lint + build green. **Not yet committed or pushed;
  migration not yet `db push`-ed.**
- Phase 4e7 master/specialist multi-agent (`src/lib/ai/specialists.ts`) — completed Phase 4.
- GitHub Actions bumped off node20 (`31123c4`, pushed, CI green). Docker now optional (hosted dev).

**Open follow-ups / to finish Wave 1:**
- **Set up the Strava app + env vars** (external, user): register at strava.com/settings/api →
  `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`; ensure `AI_SETTINGS_MASTER_KEY` is set (now also
  encrypts integration tokens). Set Strava's Authorization Callback Domain to the test host.
- `supabase db push` the new migration to the hosted DB.
- **Manual E2E** once creds exist: connect → "Sync now" → runs/rides appear on `/running` +
  timeline tagged to the Strava source; re-sync shows skipped (no dupes); disconnect keeps history.
- Still untested in a browser from prior sessions: multi-agent assistant, Phase 4e6 coach cards.
- Add `SITE_PASSCODE` to Vercel **Preview** env (dashboard).

**Decision pending — what's next after Wave 1 verified:**
- (a) **Strava auto-sync (5b)** — webhooks or Vercel cron, or
- (b) Next connector (Cronometer / Apple Health), or
- (c) Tech debt: timezone-aware pass, deployment hardening (preview DB, DMARC, health monitoring).

_Update this section at the end of each session so the next one starts here._

---

## 8. How to use this doc

- **Start of session:** "read PROJECT.md and let's continue" → Claude reads this + project memory.
- **As plans change:** ask Claude to update the feature checklists and §7. Check items off with `[x]`.
- **This is the plan; memory is the deep context.** Claude also keeps richer architectural notes in
  its project memory — this file is the human-readable map on top of that.
