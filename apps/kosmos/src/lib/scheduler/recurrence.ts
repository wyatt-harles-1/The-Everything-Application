// Recurrence helpers for shared.scheduled_events. Phase 4a2 supports a
// pragmatic subset of iCal RRULE - enough to express "every weekday at
// 7am" / "M/W/F at 5pm" / "monthly on the 1st" without dragging in a
// 50kb RRULE library. The recurrence rule lives as JSON on the schema's
// recurrence_rule column.
//
// Materialization strategy: at create time (and on user-triggered
// re-materialize) we insert real instance rows into the table covering
// the next N days. Querying is then a flat SELECT - no virtual rows -
// which keeps the rest of the codebase simple.

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

export type RecurrenceRule = {
  freq: RecurrenceFreq;
  // For weekly: 1-7 weekdays where 1=mon, 7=sun (ISO).
  // For monthly: ignored (uses scheduled_for's day-of-month).
  // For daily: ignored.
  days?: number[];
  // Optional end date. If absent, materialize forever (capped per-call
  // by the toDate parameter passed to materializeInstances).
  until?: string;   // YYYY-MM-DD
};

// Default materialization horizon: 90 days from the series start.
export const DEFAULT_HORIZON_DAYS = 90;

export function isValidRule(r: unknown): r is RecurrenceRule {
  if (!r || typeof r !== "object") return false;
  const rec = r as Record<string, unknown>;
  if (rec.freq !== "daily" && rec.freq !== "weekly" && rec.freq !== "monthly") {
    return false;
  }
  if (rec.days !== undefined) {
    if (!Array.isArray(rec.days)) return false;
    if (!rec.days.every((d) => typeof d === "number" && d >= 1 && d <= 7)) {
      return false;
    }
  }
  if (rec.until !== undefined && typeof rec.until !== "string") return false;
  return true;
}

// Generate the timestamps at which a recurring series should fire,
// between fromDate (inclusive) and toDate (exclusive). The series's
// scheduled_for anchors the time-of-day for every instance.
export function* generateInstanceDates(
  rule: RecurrenceRule,
  seriesStart: Date,
  fromDate: Date,
  toDate: Date,
): Generator<Date> {
  const untilCutoff = rule.until
    ? new Date(rule.until + "T23:59:59.999Z")
    : null;
  // Effective ceiling: min(toDate, untilCutoff).
  const ceiling =
    untilCutoff && untilCutoff < toDate ? untilCutoff : toDate;

  // Cursor = the earliest occurrence at or after max(fromDate, seriesStart),
  // anchored to the series's hour:minute:second.
  const hh = seriesStart.getHours();
  const mm = seriesStart.getMinutes();
  const ss = seriesStart.getSeconds();
  const ms = seriesStart.getMilliseconds();

  // The "lower bound" we start scanning from is whichever is later:
  // the series start, or the caller's fromDate.
  const startCursor = new Date(
    Math.max(seriesStart.getTime(), fromDate.getTime()),
  );
  // Snap cursor to the time-of-day from seriesStart.
  startCursor.setHours(hh, mm, ss, ms);

  if (rule.freq === "daily") {
    // Walk day by day from cursor.
    const cursor = new Date(startCursor);
    while (cursor < ceiling) {
      if (cursor >= seriesStart) yield new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
    }
    return;
  }

  if (rule.freq === "weekly") {
    // If no days specified, fire on seriesStart's weekday.
    const targetDays =
      rule.days && rule.days.length > 0
        ? new Set(rule.days)
        : new Set([isoWeekday(seriesStart)]);

    const cursor = new Date(startCursor);
    while (cursor < ceiling) {
      if (cursor >= seriesStart && targetDays.has(isoWeekday(cursor))) {
        yield new Date(cursor);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return;
  }

  if (rule.freq === "monthly") {
    // Fire on seriesStart's day-of-month, every month. If a given month
    // doesn't have that day (e.g., Feb doesn't have a 30th), skip it.
    const targetDay = seriesStart.getDate();
    const cursor = new Date(
      startCursor.getFullYear(),
      startCursor.getMonth(),
      1,
      hh,
      mm,
      ss,
      ms,
    );
    while (cursor < ceiling) {
      const candidate = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        targetDay,
        hh,
        mm,
        ss,
        ms,
      );
      // Reject if the candidate's day rolled into next month (e.g., Feb 30
      // becomes Mar 2). That signals the target day doesn't exist this
      // month, so skip.
      const validDay = candidate.getMonth() === cursor.getMonth();
      if (validDay && candidate >= seriesStart && candidate < ceiling) {
        yield candidate;
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return;
  }
}

// ISO weekday: 1=Mon, 2=Tue, ..., 7=Sun. JS getDay() is 0=Sun, 1=Mon.
function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

// Human-readable label for a rule. "Every Mon, Wed, Fri" / "Daily" / etc.
export function describeRule(rule: RecurrenceRule): string {
  if (rule.freq === "daily") return "Daily";
  if (rule.freq === "monthly") return "Monthly";
  // weekly
  if (!rule.days || rule.days.length === 0) return "Weekly";
  const labels = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const sorted = [...rule.days].sort((a, b) => a - b);
  return sorted.map((d) => labels[d]).join(", ");
}
