// Calendar item shape + grouping. Pure (no server-only) so both the server
// data layer and the client CalendarGrid can use it.

export type CalendarItem = {
  id: string;
  kind: "event" | "goal";
  title: string;
  dateKey: string; // "yyyy-MM-dd"
  domain?: string | null;
  status?: string | null;
  href: string; // where tapping the item navigates
};

export function groupByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const m = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const arr = m.get(it.dateKey);
    if (arr) arr.push(it);
    else m.set(it.dateKey, [it]);
  }
  return m;
}
