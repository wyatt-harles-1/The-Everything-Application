// Desktop navigation rail (lg+). Shows every destination plus an Appearance
// link, the signed-in email, and a sign-out POST form. Hidden below lg, where
// the BottomTabBar takes over.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/cn";

import { NAV_ITEMS, APPEARANCE_ITEM } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  const rowClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-[var(--radius-card)] px-3 py-2 text-sm transition-colors",
      active
        ? "bg-accent-soft font-medium text-accent"
        : "text-muted hover:bg-hover hover:text-text",
    );

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-4 lg:flex">
      <Link
        href="/"
        className="px-3 pb-4 text-base font-semibold tracking-tight text-text"
      >
        Kosmos
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={rowClass(isActive(pathname, href))}>
            <Icon size={18} strokeWidth={2} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-2 flex flex-col gap-0.5 border-t border-border pt-3">
        <Link
          href={APPEARANCE_ITEM.href}
          className={rowClass(isActive(pathname, APPEARANCE_ITEM.href))}
        >
          <APPEARANCE_ITEM.icon size={18} strokeWidth={2} aria-hidden />
          {APPEARANCE_ITEM.label}
        </Link>
        <p className="truncate px-3 pt-2 text-xs text-muted">{email}</p>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[var(--radius-card)] px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-hover hover:text-text"
          >
            <LogOut size={18} strokeWidth={2} aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
