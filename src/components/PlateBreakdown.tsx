// Plate-loading calculator. Given a target bar weight and the bar's own
// weight, returns the per-side plate decomposition using a standard
// US-pound plate set (45 / 35 / 25 / 10 / 5 / 2.5).
//
// Used inline in the gym-mode session UI under barbell-equipment exercises
// so the lifter can glance at the row and know what to load - Stronger-app
// style. Anything that can't be decomposed exactly (e.g., 47.5 with no 1.25s
// available) renders a tilde-prefixed approximation so the lifter knows the
// number is off rather than silently being wrong.

// Standard pound plates, descending. 2.5 is the smallest mainstream plate;
// fractional 1.25s exist but aren't universal so we leave them out.
const STANDARD_PLATES_LBS = [45, 35, 25, 10, 5, 2.5];

export type PlateBreakdown = {
  // Plates per side, descending. Empty when target weight <= bar.
  perSide: { plate: number; count: number }[];
  // True if the greedy decomposition exactly matches the target.
  exact: boolean;
  // Leftover (signed) - positive means undershoot, negative means overshoot.
  // Always 0 when `exact` is true.
  remainder: number;
};

export function calculatePlates(
  totalWeight: number,
  barWeight: number,
  plates: number[] = STANDARD_PLATES_LBS,
): PlateBreakdown {
  if (totalWeight <= barWeight) {
    return { perSide: [], exact: totalWeight === barWeight, remainder: 0 };
  }
  // Per side, in lbs. We assume symmetric loading - if the total is odd
  // (e.g., 100 lb on a 45 lb bar => 27.5 per side, not on a standard plate
  // set), the greedy will undershoot by some amount that ends up in the
  // remainder.
  const perSideTarget = (totalWeight - barWeight) / 2;

  let remaining = perSideTarget;
  const out: { plate: number; count: number }[] = [];
  for (const p of plates) {
    if (remaining < p) continue;
    const count = Math.floor(remaining / p);
    if (count > 0) {
      out.push({ plate: p, count });
      remaining -= count * p;
    }
  }
  // Floating-point cleanup. Anything within 0.01 lb is "exact."
  const exact = Math.abs(remaining) < 0.01;
  return {
    perSide: out,
    exact,
    remainder: exact ? 0 : remaining,
  };
}

// Render the breakdown as a compact one-liner: "2×45 + 1×10 per side"
// (or "~2×45 + 1×10 per side · +2.5" when inexact).
export function formatPlateBreakdown(b: PlateBreakdown): string {
  if (b.perSide.length === 0) {
    return b.exact ? "bar only" : "below bar";
  }
  const parts = b.perSide.map(({ plate, count }) => `${count}×${plate}`);
  const base = parts.join(" + ");
  if (b.exact) return `${base} per side`;
  // The remainder is the per-side amount we couldn't reach. Show it so the
  // lifter knows the breakdown is close-but-not-exact.
  const sign = b.remainder > 0 ? "+" : "";
  return `~${base} per side · ${sign}${b.remainder.toFixed(1)} short/side`;
}
