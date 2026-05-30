# Life Hub

A personal life-management application. Aggregates data from third-party
services (Strava, Cronometer, Apple Health, Plaid, etc.) and from
first-party modules (weightlifting, running, scheduling, health, bloodwork,
finance) into a unified, queryable timeline backed by Postgres, with an AI
assistant that can read and act across every module.

> **This file is the developer setup guide.** For the project's purpose,
> current status, feature checklists, and the active plan, see
> [`PROJECT.md`](./PROJECT.md). To resume work in a Claude session, say
> *"read PROJECT.md and let's continue."*

---

## Prerequisites

| Tool | Why | Install |
| --- | --- | --- |
| **Node 20+** | Runs the Next.js dev server | https://nodejs.org/ |
| **pnpm** | Package manager | `iwr https://get.pnpm.io/install.ps1 -useb \| iex` (Windows) |
| **Supabase CLI** | Manages + pushes migrations | https://github.com/supabase/cli/releases (Windows binary) or `scoop install supabase` |
| **Git** | Version control | https://git-scm.com/ |

> **Docker is not required.** This project develops directly against the **hosted**
> Supabase project. Docker Desktop is only needed if you choose to run the optional
> local Supabase stack (`supabase start`) — see [Optional: local Supabase](#optional-local-supabase-stack).

---

## First-time setup

```powershell
# 1. Clone (or you've already done this)
git clone <your-repo-url> .

# 2. Install JS dependencies
pnpm install

# 3. Copy the env template
Copy-Item .env.example .env.local

# 4. Fill in .env.local from the hosted Supabase project:
#      Dashboard → your project → Project Settings → API
#      "Project URL"      → NEXT_PUBLIC_SUPABASE_URL
#      "anon public" key  → NEXT_PUBLIC_SUPABASE_ANON_KEY
#      "service_role" key → SUPABASE_SERVICE_ROLE_KEY

# 5. Link the CLI to the hosted project (one-time, so `supabase db push` knows
#    where to send migrations). Grab the ref from the dashboard URL.
supabase link --project-ref <your-project-ref>

# 6. Run the dev server
pnpm dev
#  → http://localhost:3000
#  → http://localhost:3000/api/health to verify DB connection
```

---

## Day-to-day commands

```powershell
# Create a new migration (creates a timestamped SQL file in supabase/migrations/)
supabase migration new <descriptive_name>

# Push committed migrations to the hosted Supabase project (no Docker needed)
supabase db push

# Lint and type-check
pnpm lint
pnpm typecheck

# Production build (smoke test)
pnpm build
```

> Schema changes still go **only** through a migration file + `supabase db push` —
> never by editing tables in the Supabase dashboard (that causes drift).

---

## Optional: local Supabase stack

You don't need this for normal development — the steps above run entirely against
the hosted project. But if you ever want an offline, throwaway database (e.g. to
test a destructive migration without touching real data), the Supabase CLI can run
the whole stack locally **in Docker**.

```powershell
# Requires Docker Desktop installed and running.
supabase start
#  → prints a local API URL, anon key, and service_role key.
#  → Studio is at http://localhost:54323
#  Paste the printed values into .env.local to point the app at the local stack.

# Reset the local DB: drops everything, re-applies all migrations, re-runs seed.sql.
supabase db reset

# Stop the local stack when done.
supabase stop
```

---

## Project structure

```
.
├── src/
│   ├── app/
│   │   ├── (app)/            Auth-guarded app: dashboard + module hubs
│   │   │   ├── log/          Manual logging forms
│   │   │   ├── lifting/      Weightlifting module
│   │   │   ├── running/      Running module
│   │   │   ├── health/       Health hub
│   │   │   ├── schedule/     Scheduler / planner
│   │   │   ├── habits/       Habit tracking
│   │   │   ├── goals/        Goals
│   │   │   └── assistant/    AI assistant (chat, threads, memory, settings)
│   │   ├── (auth)/           Login / auth callback
│   │   ├── api/              Route handlers (health, assistant/*)
│   │   └── layout.tsx        Root HTML layout
│   ├── lib/
│   │   ├── supabase/         Browser / server / admin clients
│   │   ├── ai/               Assistant: provider, tools, mutations, coach, memory
│   │   ├── validation/       Zod schemas
│   │   └── …                 Domain helpers (lifting, running, scheduler, format)
│   └── components/           Shared UI components
├── supabase/
│   ├── migrations/           Versioned SQL — checked in
│   ├── config.toml           Local stack config (api.schemas list lives here)
│   └── seed.sql              Data applied on `supabase db reset`
├── PROJECT.md                Living plan + status (start here)
├── CLAUDE.md                 Instructions Claude auto-loads
├── .env.example              Env template — committed
├── .env.local                Real env values — gitignored
└── package.json
```

---

## Architectural principles

These three patterns are load-bearing across every future phase. Don't
shortcut them.

1. **One row per record, regardless of origin.** Whether you typed in a
   workout or Strava synced it, both end up in the same table with a
   `source_id` foreign key pointing at `shared.sources`. The system is built
   to never fork a table by where the data came from.

2. **Domains are separated by Postgres schemas.** `wellness`, `productivity`,
   `shared` today; `finance` and `knowledge` later. `public` is reserved for
   Supabase Auth and extensions — application tables don't live there.

3. **Every meaningful occurrence emits an `events` row.** Workouts, meals,
   sleep, calendar events, transactions later — each writes a row to
   `shared.events` with a back-pointer to its detail table. The events table
   is the single chronological substrate cross-domain AI queries will run
   against in Phase 6+.

Plus: **Row Level Security is on from day one.** Even though you're the only
user during development, the policies ARE the production contract. Turning
RLS on after data exists is much harder than starting with it on.

---

## Status & roadmap

Phases 1–3 (foundation, manual logging, weightlifting) are complete, and
Phase 4 (base Life Hub features — scheduler, goals, dashboard, running/health
modules, AI assistant) is mostly shipped. Integrations (Strava, Cronometer,
Apple Health, Plaid) and the finance/knowledge domains are still ahead.

For the detailed, always-current status — feature checklists, the phase
roadmap, known tech debt, and what's being worked on right now — see
[`PROJECT.md`](./PROJECT.md).
