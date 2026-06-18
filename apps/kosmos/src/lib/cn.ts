// Tiny class-name helper used across the UI component layer. clsx handles
// conditional/array class composition; tailwind-merge resolves conflicting
// Tailwind utilities so a caller's `className` can override a component's
// defaults (e.g. passing `rounded-none` actually beats a built-in
// `rounded-card`). Standard shadcn-style `cn()`.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
