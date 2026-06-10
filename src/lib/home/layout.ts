// Home dashboard layout model. Each home section is a "widget" with a stable
// id; the user's saved order + hidden set live in shared.user_preferences
// .home_layout. Keeping ids stable means we can add widgets later and old saved
// layouts still resolve (new ids append to the end via normalizeOrder).

export const HOME_WIDGET_IDS = [
  "today",
  "training",
  "habits",
  "goals",
  "quicklog",
  "sections",
  "recent",
] as const;

export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number];

export const DEFAULT_HOME_ORDER: HomeWidgetId[] = [...HOME_WIDGET_IDS];

export const WIDGET_LABELS: Record<HomeWidgetId, string> = {
  today: "Today",
  training: "Training block",
  habits: "Habits this week",
  goals: "Top goals",
  quicklog: "Quick log",
  sections: "Sections",
  recent: "Recent activity",
};

export type HomeLayout = { order: string[]; hidden: string[] };

function isWidgetId(id: string): id is HomeWidgetId {
  return (HOME_WIDGET_IDS as readonly string[]).includes(id);
}

// Keep only valid ids from the saved order, then append any widget ids not yet
// present so newly-added widgets show up at the bottom for existing users.
export function normalizeOrder(saved: string[] | undefined | null): HomeWidgetId[] {
  const valid = (saved ?? []).filter(isWidgetId);
  const missing = DEFAULT_HOME_ORDER.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

export function normalizeHidden(saved: string[] | undefined | null): HomeWidgetId[] {
  return (saved ?? []).filter(isWidgetId);
}
