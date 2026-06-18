import type { NextConfig } from "next";
import path from "path";

// Pin Next.js's root to the monorepo root (two levels up from apps/kosmos).
// In a pnpm workspace the lockfile + shared packages live at the repo root, so
// file tracing must start there — otherwise Next either walks further up to the
// stray `package-lock.json` at C:\Users\wyatt\ (warning on every build) or
// fails to trace files imported from workspace packages. Two settings are
// needed because the dev server (Turbopack) and the production build read
// different fields.
const workspaceRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  outputFileTracingRoot: workspaceRoot,
};

export default nextConfig;
