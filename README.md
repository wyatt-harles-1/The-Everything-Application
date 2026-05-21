# Life Hub

A personal life-management application. Aggregates data from third-party
services (Strava, Cronometer, Apple Health, Plaid, etc.) and from
first-party modules (weightlifting, mobility, scheduling, bloodwork,
finance) into a unified, queryable timeline backed by Postgres.

This is **Phase 1**: the foundation only — schemas, the universal events
pattern, RLS, a deployment pipeline. There is no UI yet beyond a placeholder
landing page and a health-check endpoint. Manual logging arrives in Phase 2.

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
│   ├── app/                  Next.js App Router
│   │   ├── (auth)/           Auth pages (Phase 2)
│   │   ├── api/health/       Health-check route handler
│   │   ├── layout.tsx        Root HTML layout
│   │   └── page.tsx          Landing page (placeholder)
│   ├── lib/
│   │   ├── supabase/         Three clients: browser / server / admin
│   │   └── types/            Shared TypeScript types (empty in Phase 1)
│   ├── modules/              First-party feature modules (Phase 3+)
│   └── components/           Shared UI components (Phase 2+)
├── supabase/
│   ├── migrations/           Versioned SQL — checked in
│   └── seed.sql              Data applied on `supabase db reset`
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

## Known limitations of Phase 1

- **No UI features.** The landing page is a placeholder. Manual logging UI
  arrives in Phase 2.
- **No auth flow.** Supabase Auth is wired into the clients but there's no
  sign-in / sign-up page yet. Create users in Supabase Studio for now.
- **No domain tables.** `wellness.workouts`, `wellness.meals`, etc. arrive
  with Phase 2 and the weightlifting module in Phase 3.
- **No integrations.** Strava / Cronometer / Plaid / etc. start in Phase 5.
- **No AI features.** Personal trainer / doctor / financial advisor start in
  Phase 6.

---

## Phase roadmap

| Phase | Scope |
| --- | --- |
| **1** (you are here) | Project foundation, database schema, deployment pipeline |
| 2 | Manual logging UI + first domain tables |
| 3 | Weightlifting module |
| 4 | Scheduling engine + module system |
| 5 | Wellness integrations (Strava, Cronometer, Apple Health) |
| 6 | Dashboard + AI personal trainer |
| 7 | Bloodwork module + AI doctor |
| 8 | Finance domain + AI financial advisor |
