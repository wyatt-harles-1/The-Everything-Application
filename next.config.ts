import type { NextConfig } from "next";
import path from "path";

// Pin Next.js to *this* project as the workspace root. Without these, Next
// walks up the directory tree looking for a lockfile and finds the stray
// `package-lock.json` at C:\Users\wyatt\, then prints a warning on every
// `pnpm dev` / `pnpm build`. Two settings are needed because the dev server
// (Turbopack) and the production build read different fields.
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
