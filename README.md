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
| **Docker Desktop** | Hosts the local Supabase stack | https://www.docker.com/products/docker-desktop/ |
| **Supabase CLI** | Manages migrations + local stack | https://github.com/supabase/cli/releases (Windows binary) or `scoop install supabase` |
| **Git** | Version control | https://git-scm.com/ |

> **Docker Desktop must be running** before `supabase start`.

---

## First-time setup

```powershell
# 1. Clone (or you've already done this)
git clone <your-repo-url> .

# 2. Install JS dependencies
pnpm install

# 3. Copy the env template
Copy-Item .env.example .env.local

# 4. Start the local Supabase stack (Postgres + Studio + Auth, all in Docker)
supabase start
#  → prints API URL, anon key, and service_role key.
#  → Studio is at http://localhost:54323

# 5. Paste those three values into .env.local:
#      NEXT_PUBLIC_SUPABASE_URL=<API URL>
#      NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
#      SUPABASE_SERVICE_ROLE_KEY=<service_role key>

# 6. Run the dev server
pnpm dev
#  → http://localhost:3000
#  → http://localhost:3000/api/health to verify DB connection
```

---

## Day-to-day commands

```powershell
# Reset the local database (drops everything, re-applies all migrations,
# re-runs seed.sql). Use this whenever you want a clean slate.
supabase db reset

# Create a new migration (creates a timestamped SQL file in supabase/migrations/)
supabase migration new <descriptive_name>

# Push committed migrations to the hosted Supabase project
supabase db push

# Lint and type-check
pnpm lint
pnpm typecheck

# Production build (smoke test)
pnpm build
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
