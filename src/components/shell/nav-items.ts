// Single source of truth for the app's navigation destinations, shared by the
// desktop sidebar and the mobile bottom-bar / More sheet so they never drift.

import {
  Home,
  ClipboardList,
  Calendar,
  Repeat,
  Target,
  Dumbbell,
  Footprints,
  HeartPulse,
  Sparkles,
  Plug,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Full destination list — rendered top-to-bottom in the desktop sidebar.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/log", label: "Log", icon: ClipboardList },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/lifting", label: "Lifting", icon: Dumbbell },
  { href: "/running", label: "Running", icon: Footprints },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

export const APPEARANCE_ITEM: NavItem = {
  href: "/settings/appearance",
  label: "Appearance",
  icon: Settings,
};

// Mobile bottom bar shows Home, Log, (center +Add), Assistant, More. Everything
// NOT on the bar lives in the More sheet, plus Appearance.
const TAB_HREFS = new Set(["/", "/log", "/assistant"]);
export const MORE_ITEMS: NavItem[] = [
  ...NAV_ITEMS.filter((i) => !TAB_HREFS.has(i.href)),
  APPEARANCE_ITEM,
];
