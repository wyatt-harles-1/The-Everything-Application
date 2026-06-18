// Streak + weekly-progress math for shared.habits.
//
// Habits derive their state from shared.events filtered by domain (and
// optionally event_type). The database stores no streak counter - any
// retroactive log/delete on the timeline is automatically reflected.
//
// Weeks are Monday-anchored (ISO). The "current week" is the partial
// week containing today; older weeks are fully closed.

export type EventOccurrence = {
  occurred_at: string;
};

// Monday-anchored start-of-week (00:00:00 local). Sunday rolls back to
// the prior Monday so a Sunday-evening log doesn't kick into next week.
export function startOfISOWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = out.getDay();        // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  out.setDate(out.getDate() + delta);
  return out;
}

export type HabitProgress = {
  // 1-indexed completions THIS week (Mon -> now).
  thisWeekCount: number;
  // The target the habit asks for.
  target: number;
  // True when thisWeekCount >= target.
  thisWeekMet: boolean;
  // Consecutive PAST weeks (not counting this week) where target was met.
  // Continues from the most recent closed week backward; stops at the first
  // week the target wasn't met.
  streakWeeks: number;
  // True when this week is already met OR there are still days remaining
  // and the streak could survive. Useful for the UI label color.
  isStreakAlive: boolean;
};

// Compute progress + streak from raw event occurrences. The caller is
// responsible for filtering events to those that match the habit's
// domain / event_type / started_at.
export function computeHabitProgress(
  events: EventOccurrence[],
  target: number,
  habitStartedAt: Date,
  now: Date = new Date(),
): HabitProgress {
  const thisWeekStart = startOfISOWeek(now);
  const eventsByWeek = new Map<number, number>(); // weekStart epoch -> count

  for (const e of events) {
    const when = new Date(e.occurred_at);
    if (when < habitStartedAt) continue;
    const wkStart = startOfISOWeek(when).getTime();
    eventsByWeek.set(wkStart, (eventsByWeek.get(wkStart) ?? 0) + 1);
  }

  const thisWeekCount = eventsByWeek.get(thisWeekStart.getTime()) ?? 0;
  const thisWeekMet = thisWeekCount >= target;

  // Walk past weeks from (thisWeek - 1) backward.
  let streakWeeks = 0;
  const cursor = new Date(thisWeekStart);
  cursor.setDate(cursor.getDate() - 7);
  // Stop at the habit's started_at week so we don't count weeks before
  // the user committed to the habit.
  const habitStartWeek = startOfISOWeek(habitStartedAt).getTime();
  while (cursor.getTime() >= habitStartWeek) {
    const count = eventsByWeek.get(cursor.getTime()) ?? 0;
    if (count >= target) {
      streakWeeks += 1;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }

  // The streak is "alive" if the target's already met this week OR if
  // there's still time left in the week to plausibly hit it.
  const daysLeftThisWeek = 7 - Math.floor(
    (now.getTime() - thisWeekStart.getTime()) / (1000 * 60 * 60 * 24),
  );
  const needed = target - thisWeekCount;
  const isStreakAlive = thisWeekMet || daysLeftThisWeek >= needed;

  return { thisWeekCount, target, thisWeekMet, streakWeeks, isStreakAlive };
}
