# Kosmos — Claude instructions

**Start here:** read [`PROJECT.md`](./PROJECT.md) for the project's purpose, current status, feature
checklists, and the active plan. The **Current focus** section at the bottom of PROJECT.md is the
handoff point between sessions — that's where to "pick up where we left off."

## What this is

Kosmos (formerly "Life Hub"; repo name "The Everything Application") — a private personal
life-management app (training, health,
habits, goals, schedule, later finance) on a unified Postgres timeline, with an AI assistant that
can read and act across all of it.

## How to work with me

- I have **limited coding experience** — prefer clarity over cleverness, and explain non-obvious
  decisions (RLS, schema design, architectural patterns) inline as comments.
- **Pause at decision points** rather than barreling ahead; verify after each step; flag blockers
  early. Confirm before destructive or hard-to-reverse actions.
- Windows 11, PowerShell as the primary shell.

## Load-bearing rules (don't break these — see PROJECT.md §3 for why)

- **One Supabase project, one schema per domain** (`shared`, `wellness`, `productivity`).
- **`shared.events`** is the universal timeline; **`shared.goals`** owns all goals;
  **`shared.sources`** tags every row's origin.
- **RLS on every table**, scoped to the signed-in user.
- **Server Actions are tool-shaped**; **every module has a `<domain>_rules` table**.
- **Schema changes only via migration + `supabase db push`** — never edit in the Supabase dashboard.
  Add new domain schemas to `supabase/config.toml`'s `api.schemas` array.

## Stack & commands

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · Supabase · Vercel AI SDK · pnpm.
Before pushing: `pnpm typecheck` and `pnpm lint` (CI also runs `pnpm build`). See `README.md` for
local setup.
