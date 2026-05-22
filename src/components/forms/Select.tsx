// Native <select>. Browser's built-in picker is the right choice on mobile -
// no third-party combobox can match the iOS / Android native picker UX.

import type { SelectHTMLAttributes, ReactNode } from "react";

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={`min-h-11 w-full appearance-none rounded-md border border-zinc-300 bg-white bg-[length:18px_18px] bg-[right_0.75rem_center] bg-no-repeat px-3 py-2 pr-9 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50 ${className}`}
      style={{
        // Inline SVG chevron so we don't need an icon library or extra files.
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'><path fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/></svg>\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
}
