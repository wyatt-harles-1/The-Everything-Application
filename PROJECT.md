# Kosmos — Project Plan & Status

> **Living document.** This is the north star and the current state of the project in one place:
> what we're building, why, what's done, what's left, and what we're working on right now.
>
> **To resume a session:** tell Claude *"read PROJECT.md and let's continue."* Claude updates the
> checklists and the **Current focus** section as work lands, so this file is always the handoff
> point between sessions.

**Last updated:** 2026-06-11

---

## 1. Purpose

Kosmos (formerly "Life Hub"; repo name "The Everything Application") is a personal
life-management system that pulls every meaningful thing in my life — training, health, habits,
goals, schedule, and eventually finances and more — into one private, queryable place. Data arrives three ways: things I log by hand in
Kosmos, cloud APIs that sync automatically (Strava today), and imports from the best-of-breed
apps I actually track my life with (Strong for lifting, Cronometer for food, 8 Sleep for sleep).

Everything lands on a single chronological timeline backed by Postgres, so an AI assistant can
reason across all of it ("how did my sleep affect my lifts last month?") instead of each feature
living in its own silo.

## 2. Goals & vision

- **One database for your whole life.** Every tracker — Kosmos-native or third-party — feeds the
  same unified timeline. Kosmos is the aggregation and intelligence layer on top: the place where
  sleep, training, food, mood, and (later) money can finally be queried together.
- **Hybrid tracking, imports first-class.** The apps I already use are better capture tools than
  anything I'd rebuild, so they stay primary where they're strong: **Strong** for lifting,
  **Cronometer** for food, **8 Sleep** for sleep, **Strava** for cardio. Kosmos's own logging UIs
  are primary for everything those apps don't cover (mood, meds, habits, goals, bloodwork) and a
  fallback everywhere else. Getting external data in is a core feature, not an afterthought.
- **The Office-suite model.** Kosmos is the suite; each life aspect (training, food, sleep,
  finance, …) eventually becomes its own polished app — like Word / Excel / PowerPoint, but for
  aspects of one's life — all integrating smoothly into the same ecosystem: one timeline, one
  goals system, one AI that sees everything. Architecture invariant #6 ("apps are organizational
  units, not data boundaries") is what keeps that extraction a mechanical move later, not a
  rewrite — so nothing gets extracted yet, but nothing closes the door either.
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
  idempotent via a `(source_id, external_id)` unique index. Auto-sync landed in Phase 5b (below).
  Code: `src/lib/integrations/{strava,sources}.ts`, `src/app/api/integrations/strava/*`,
  `src/app/(app)/integrations/*`.
- **Integrations — Oura (Phase 5c):** OAuth connect + manual "Sync now" at `/integrations`.
  Imports main nightly **sleep** → `wellness.sleep_sessions` (quality from efficiency; HRV/RHR in
  notes) and **daily readiness** → the new `wellness.readiness` table (score, HRV, resting HR, temp
  deviation). Both emit timeline events; the health hub shows a **Recovery** card. Same
  source/encryption/idempotency pattern as Strava (`src/lib/integrations/oura.ts`, Oura source
  helpers in `sources.ts`, `src/app/api/integrations/oura/*`). Tokens use form-encoded OAuth.
  Readiness is wired into the AI: a `query_readiness` read tool (master + health specialist) and
  the health coach's daily context both see recovery, so the assistant can correlate it with training.
  **Status: dormant** — built and kept as the reference cloud-API connector, but I don't use an
  Oura ring (decided 2026-06-11); sleep data will come from 8 Sleep instead.
- **Auto-sync (Phase 5b):** daily **Vercel Cron** (`vercel.json` → `/api/cron/sync`, 08:00 UTC)
  pulls every active integration without a button press. Shared sync cores in
  `src/lib/integrations/sync.ts` run from both the manual "Sync now" actions (RLS client) and the
  cron (service-role admin client, explicit `user_id` per source). Route is gated by `CRON_SECRET`
  (Vercel sends it as the Bearer) and exempt from the passcode middleware. Idempotent + incremental,
  so a daily re-run is safe.
- **Operational lock:** site-wide passcode gate at `/gate` — controlled by the `SITE_PASSCODE`
  env var, custom Kosmos-styled passcode page, HttpOnly + Secure cookie holds a SHA-256 hash
  (cleartext never stored), sits in front of Supabase auth. Toggle on/off by setting or removing
  the env var in Vercel.
- **UI redesign + Kosmos rebrand (Milestones 1–2)** *(merged to `main` + live in prod 2026-06-10)*:
  - **M1 — design system + shell:** semantic design tokens in `globals.css` (light/dark/amoled
    themes, 6 accent colors, density) with FOUC-free persistence (cookie mirror +
    `shared.user_preferences`); app shell with desktop sidebar + mobile bottom tab bar
    (Quick-add/More sheets); shared `ui/` component layer (`src/components/ui/*`); home dashboard
    decomposed into reorderable/hideable widgets (dnd-kit); appearance settings page. Bundled
    security hardening: managed-key + bloodwork-upload allowlists, OAuth token clearing on
    disconnect, anon-grant revoke, signup disable.
  - **M2 — data viz + PWA:** Recharts chart kit themed via CSS vars (`src/components/charts/*`);
    reusable trend builders (`src/lib/analytics/*`); Health dashboard (`/health/dashboard` —
    sleep, recovery, mood, weight); home calendar + trend chart widgets; full `/calendar` page
    (month/week/day over scheduled events + goal deadlines); installable PWA (manifest, service
    worker, offline page); renamed the app from "Life Hub" to **Kosmos** throughout the UI.

### 🔭 Wanted but not started

- **Personal-stack integrations (Phase 5 — remaining):** **Strong CSV import** (lifting →
  existing workout/lifting tables), **Cronometer CSV import** (food → meals/nutrition), and an
  **8 Sleep connector** (unofficial API → `wellness.sleep_sessions`). Manual file upload is the
  v1 for the CSV pair; see the Integrations strategy below. On-device hubs (Apple Health /
  Google Health Connect / Samsung) still need a **companion app** — a later, separate effort.
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

### 🔌 Integrations strategy (how Phase 5+ sources connect)

The decision that shapes the whole integrations roadmap: **data sources split into three camps,
and only the first is cleanly reachable from a web backend.**

1. **Cloud-API services** — expose an OAuth web API we can pull from Kosmos's server, exactly
   like Strava. These get server-side connectors:
   - **Strava** — workouts/activities (✅ live). Not an everything-aggregator, but it *does*
     aggregate workouts: Garmin / Apple Watch / Wahoo / Peloton etc. push activities into Strava,
     so it's the single best source for **training**. It has no sleep / nutrition / body / all-day HR.
   - **Oura** — sleep/recovery (✅ built, dormant — no ring; kept as the reference connector).
   - **8 Sleep** — sleep. *No official public API*, but a well-documented **unofficial OAuth2
     API** that community projects rely on (Home Assistant integration, `pyEight`, `eightctl`) —
     connector-shaped like Strava/Oura, with the caveat Eight Sleep may change endpoints without
     notice.
   - Fitbit / Whoop / Withings / Garmin — good APIs, but **not in my stack**; only if ever needed.

2. **File-export apps — no usable API, but an official CSV export.** The path here is an
   **import pipeline**: export from the app, upload at `/integrations`, parse into the same
   domain tables + timeline (tagged to a `provider` source row, idempotent like the connectors):
   - **Strong** (lifting) — no API at all; clean CSV export (date, workout, exercise, set order,
     weight, reps, …).
   - **Cronometer** (food) — public API is partner-gated; official CSV exports (servings,
     biometrics, exercises). Later option: automate pulls via its unofficial export endpoint
     (the GWT-RPC calls the web app itself uses — cf. the `gocronometer` library).

3. **On-device platforms — NO web API exists** (the big gotcha):
   - **Apple Health (HealthKit)** — iOS, data lives on the phone; no server endpoint.
   - **Google** — Fit's REST API was deprecated; its successor **Health Connect** is on-device Android only.
   - **Samsung Health** — on-device Android SDK, partner-only.
   These are exactly the aggregators we'd want, but they can only be reached by a **companion
   mobile app** (native / React Native) that reads HealthKit / Health Connect and pushes to our
   API — a separate project. The only no-code fallback is manual export/import (e.g. the Apple
   Health XML zip).

**The actual stack (what I track my life with today):**

| Life aspect | App | Path into Kosmos |
| --- | --- | --- |
| Cardio / activities | Strava | ✅ cloud-API connector, live + daily cron |
| Lifting | Strong | CSV import (no API exists) |
| Food | Cronometer | CSV import first; unofficial export endpoint later |
| Sleep | 8 Sleep | Connector on the unofficial API |
| Finances | Several apps | Deferred to the finance phase — much larger undertaking |

**Implication:** there is no single magic source to "pull everything" from server-side. Kosmos
gets **one pathway per life aspect**, matched to the app I actually use — and the
`shared.sources` + universal `events` design makes each one mechanical: a CSV importer and an
OAuth connector are just different feeders for the same source rows and tables.
Apple/Google/Samsung are a *later* companion-app effort, not a quick OAuth connector.

---

## 6. Phase roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: schemas, events, RLS, deploy pipeline | ✅ |
| 1.5 | Deployment wiring | ✅ |
| 2 | Manual logging UI + wellness tables | ✅ |
| 3 | Weightlifting module | ✅ ("good enough for now") |
| **4** | **Base hub features** | ✅ complete |
| · 4a | Scheduler/planner + habits | ✅ |
| · 4b | Personal goals UI | ✅ |
| · 4c | Main dashboard redesign | ✅ |
| · 4d | Module priority pass (running, health) | ✅ |
| · 4e | AI assistant (chat → tools → memory → coach → multi-agent) | ✅ |
| **5** | **Personal-stack integrations** (current) | 🚧 Strava live |
| · 5a | Strava: OAuth connect + manual "Sync now" | ✅ verified in prod |
| · 5b | Auto-sync — daily Vercel Cron | ✅ verified in prod |
| · 5c | Oura connector (sleep + readiness/HRV) | ✅ built (dormant — no ring) |
| · 5d | CSV import pipeline: shared upload UI at `/integrations`; Strong importer (lifting), Cronometer importer (food) | ⬜ |
| · 5e | 8 Sleep connector (unofficial API → sleep_sessions) | ⬜ |
| · 5f | On-device hubs (Apple Health / Google Health Connect / Samsung) — needs a companion app | ⬜ |
| 6+ | Bloodwork + AI doctor, knowledge, standalone-app extraction; Finance + AI advisor (deferred — large undertaking) | ⬜ |

---

## 7. Current focus — pick up here

**Just landed (2026-06-09; merged to `main` + deployed to prod 2026-06-10 via PRs #1/#2):**
- **UI redesign Milestone 1** (`584cd42`): the soft/airy design-system foundation. Semantic design
  tokens in `globals.css` (light/dark/amoled themes, 6 accent colors, density) with FOUC-free
  persistence (cookie + `shared.user_preferences`); new app shell (desktop sidebar + mobile bottom
  tab bar with Quick-add/More sheets, retires `Nav.tsx`); shared `ui/` component layer; home
  dashboard decomposed into reorderable/hideable widgets (dnd-kit); appearance settings page. Also
  bundled earlier security hardening (managed-key + bloodwork-upload allowlists, OAuth token
  clearing on disconnect, anon-grant revoke, signup disable).
- **UI redesign Milestone 2** (`1f3d98d`): the visual-intelligence layer + installable app.
  Recharts chart kit themed via CSS vars (`src/components/charts/*`); reusable analytics/trend
  builders (`src/lib/analytics/*`); **Health dashboard** at `/health/dashboard` (sleep, Oura
  recovery, mood, weight — the template for other modules in M3); home calendar + sleep/weight/
  mood/training-load chart widgets; full `/calendar` page (month/week/day); **PWA** (manifest,
  service worker, offline page, icons); **rebrand Life Hub → Kosmos**.
- Earlier this month (already on `main`): Phase 5b auto-sync, Phase 5c Oura connector, and the
  readiness → AI wiring are all committed (`bc81515` and prior) — see §5 for detail.
- **Redesign is LIVE:** both milestone branches merged (CI green), prod deploy completed, both
  June 9 migrations (`revoke_anon_table_grants`, `shared_user_preferences`) confirmed applied to
  the hosted DB, and the PWA manifest serves the Kosmos branding in prod.
- **Auto-sync (5b) verified in prod (2026-06-11):** `CRON_SECRET` set in Vercel; authenticated
  call to `/api/cron/sync` returned a JSON summary (Strava ran, incremental no-op as expected).
  The daily 08:00 UTC cron is live.
- **Vision recorded (2026-06-11):** §2 now captures the Office-suite model (Kosmos = the suite;
  life-aspect modules become standalone apps later) and the hybrid-tracking principle (imports
  from my real apps primary, native logging secondary). §5/§6 re-pointed at the actual stack:
  Strong (lifting), Cronometer (food), 8 Sleep (sleep). **Oura decision: no ring — connector
  stays built but dormant**; its registration follow-up is dropped.

**Open follow-ups:**
- Still untested in a browser: multi-agent assistant, Phase 4e6 coach cards. Add `SITE_PASSCODE` to
  Vercel Preview env.

**Next up — personal-stack integrations (order adjustable):**
1. **Strong CSV import** (Phase 5d, first) — simplest format, and it maps onto the existing rich
   lifting/workout tables; build the shared upload UI at `/integrations` with it.
2. **Cronometer CSV import** (5d) — reuses the same upload pipeline.
3. **8 Sleep connector** (5e) — unofficial API; shaped like the Strava/Oura connectors.

After that, the bench: redesign Milestone 3 (roll the dashboard/chart template to lifting and
running), bloodwork module UI + AI doctor, or the tech-debt pass (timezones, preview DB, DMARC,
health monitoring).

_Update this section at the end of each session so the next one starts here._

---

## 8. How to use this doc

- **Start of session:** "read PROJECT.md and let's continue" → Claude reads this + project memory.
- **As plans change:** ask Claude to update the feature checklists and §7. Check items off with `[x]`.
- **This is the plan; memory is the deep context.** Claude also keeps richer architectural notes in
  its project memory — this file is the human-readable map on top of that.
