// /lifting/rules - module rules table UI (invariant #8). One row per
// user. First read: returns defaults if no row exists yet; the upsert in
// saveLiftingRules creates the row on first save.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { LiftingRulesForm } from "./LiftingRulesForm";
import { saveLiftingRules } from "./actions";

type Rules = {
  frequency_per_week: number;
  preferred_days: number[] | null;
  default_time: string;
  skip_deload: boolean;
  notes: string | null;
};

const DEFAULTS: Rules = {
  frequency_per_week: 3,
  preferred_days: null,
  default_time: "17:00",
  skip_deload: false,
  notes: null,
};

export default async function LiftingRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();

  const { data: row } = await supabase
    .schema("wellness")
    .from("lifting_rules")
    .select(
      "frequency_per_week, preferred_days, default_time, skip_deload, notes",
    )
    .maybeSingle();
  const rules = (row ?? DEFAULTS) as Rules;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/lifting"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Lifting
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Lifting rules
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Settings the suggestion engine + future AI assistant consult
          before proposing lifting sessions for your week.
        </p>
      </header>

      {flash === "saved" ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Saved ✓
        </p>
      ) : null}

      <LiftingRulesForm
        action={saveLiftingRules}
        submitLabel="Save rules"
        defaults={{
          frequency_per_week: rules.frequency_per_week,
          preferred_days: rules.preferred_days ?? [],
          default_time: rules.default_time,
          skip_deload: rules.skip_deload,
          notes: rules.notes ?? "",
        }}
      />
    </div>
  );
}
