// ESLint flat-config (eslint.config.mjs) for Next 15.
// Next 15's eslint-config-next still ships as legacy .eslintrc-style configs,
// so we wrap them with FlatCompat to use them in flat config. This is the
// canonical pattern for Next 15. Next 16 made flat-config a first-class
// export and dropped the need for FlatCompat — when we eventually upgrade,
// this file can be simplified.

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Flat-config doesn't auto-ignore build artifacts the way the old
  // .eslintrc setup did. Without this block, `pnpm lint` walks into .next/
  // and emits thousands of warnings for Webpack-generated runtime chunks.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
