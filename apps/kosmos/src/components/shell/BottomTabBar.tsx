// Mobile bottom tab bar (below lg). Five slots: Home · Log · raised +Add ·
// Assistant · More. +Add and More are buttons that open sheets (handled by the
// parent AppShell); the rest are route links with active highlighting.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Plus, Sparkles, Menu, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
        active ? "text-accent" : "text-muted",
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

export function BottomTabBar({
  onOpenMore,
  onOpenAdd,
}: {
  onOpenMore: () => void;
  onOpenAdd: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex h-16 w-full items-stretch">
        <Tab href="/" label="Home" icon={Home} active={isActive(pathname, "/")} />
        <Tab href="/log" label="Log" icon={ClipboardList} active={isActive(pathname, "/log")} />

        <button
          type="button"
          onClick={onOpenAdd}
          aria-label="Quick add"
          className="flex flex-1 flex-col items-center justify-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-fg shadow-soft transition-transform active:scale-95">
            <Plus size={24} strokeWidth={2.4} aria-hidden />
          </span>
        </button>

        <Tab
          href="/assistant"
          label="Assistant"
          icon={Sparkles}
          active={isActive(pathname, "/assistant")}
        />

        <button
          type="button"
          onClick={onOpenMore}
          aria-label="More"
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted transition-colors"
        >
          <Menu size={22} strokeWidth={2} aria-hidden />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
