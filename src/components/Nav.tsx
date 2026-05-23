// Top nav for the auth-protected (app) route group. Mobile-first: on screens
// narrower than `sm` we collapse the links into a hamburger drawer; on bigger
// screens they sit inline. The active route is underlined so you can tell
// where you are without reading.
//
// Client Component because the hamburger needs open/close state. The sign-out
// "button" still uses the existing /auth/logout route handler via a real
// <form> POST, so it works without JS (and the rest of the nav is just <a>
// tags too).

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/log", label: "Log" },
  { href: "/lifting", label: "Lifting" },
];

export function Nav({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight"
          onClick={() => setOpen(false)}
        >
          Life Hub
        </Link>

        {/* Desktop / md+: inline links + sign out */}
        <nav className="hidden items-center gap-6 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition-colors ${
                isActive(l.href)
                  ? "font-medium text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <SignOutButton />
        </nav>

        {/* Mobile: hamburger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md sm:hidden"
        >
          {/* Two-line vs X icon. CSS-only so no icon library needed. */}
          <span className="relative block h-4 w-5">
            <span
              className={`absolute left-0 top-0 block h-0.5 w-5 bg-current transition-transform ${
                open ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-2 block h-0.5 w-5 bg-current transition-opacity ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute bottom-0 left-0 block h-0.5 w-5 bg-current transition-transform ${
                open ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <nav className="border-t border-zinc-200 px-4 py-2 sm:hidden dark:border-zinc-800">
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block min-h-11 rounded-md px-3 py-2.5 text-sm ${
                    isActive(l.href)
                      ? "bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <p className="px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                {email}
              </p>
              <SignOutButton mobile />
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function SignOutButton({ mobile = false }: { mobile?: boolean }) {
  return (
    <form action="/auth/logout" method="post" className={mobile ? "" : ""}>
      <button
        type="submit"
        className={
          mobile
            ? "block w-full rounded-md px-3 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
            : "text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        }
      >
        Sign out
      </button>
    </form>
  );
}
