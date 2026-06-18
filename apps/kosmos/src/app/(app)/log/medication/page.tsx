// Medication hub: lists active + inactive meds, a quick "log dose" form,
// and a recent dose history. Add and edit go to /new and /[id] respectively.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatDate } from "@/lib/format";

import { LogDoseForm } from "./LogDoseForm";
import { deleteDose } from "./actions";

export default async function MedicationHubPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;

  const supabase = await createClient();

  const { data: meds } = await supabase
    .schema("wellness")
    .from("medications")
    .select("id, name, dosage, frequency, started_on, ended_on, purpose")
    .order("ended_on", { ascending: true, nullsFirst: true })  // active first
    .order("name", { ascending: true });

  const active = (meds ?? []).filter((m) => m.ended_on === null);
  const inactive = (meds ?? []).filter((m) => m.ended_on !== null);

  // Recent dose history with med names joined client-side (RLS scopes both).
  const { data: doses } = await supabase
    .schema("wellness")
    .from("medication_logs")
    .select("id, medication_id, taken_at, dose_taken, skipped, notes")
    .order("taken_at", { ascending: false })
    .limit(50);

  const medNameById = new Map((meds ?? []).map((m) => [m.id, m.name] as const));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link href="/log" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Back to log
        </Link>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Medications</h1>
          <Link
            href="/log/medication/new"
            className="text-sm font-medium underline underline-offset-4"
          >
            Add medication →
          </Link>
        </div>
      </header>

      {flash === "med_deleted" ? <Banner kind="warn">Medication and its doses deleted.</Banner> : null}
      {flash === "dose_logged" ? <Banner kind="ok">Dose logged ✓</Banner> : null}
      {flash === "dose_deleted" ? <Banner kind="warn">Dose deleted.</Banner> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Log a dose</h2>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <LogDoseForm
            medications={active.map((m) => ({ id: m.id, name: m.name, dosage: m.dosage }))}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No active medications. Add one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/log/medication/${m.id}`}
                  className="block rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {[m.dosage, m.frequency, m.purpose].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {m.started_on ? (
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      since {formatDate(`${m.started_on}T00:00:00Z`)}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {inactive.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Inactive ({inactive.length})
          </h2>
          <ul className="space-y-2">
            {inactive.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/log/medication/${m.id}`}
                  className="block rounded-md border border-dashed border-zinc-200 p-3 opacity-70 hover:bg-zinc-50 hover:opacity-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {m.started_on ? formatDate(`${m.started_on}T00:00:00Z`) : "?"} – {m.ended_on ? formatDate(`${m.ended_on}T00:00:00Z`) : "?"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Recent doses
        </h2>
        {!doses || doses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No doses logged yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {doses.map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {medNameById.get(d.medication_id) ?? "(deleted med)"}
                    {d.skipped ? (
                      <span className="ml-2 text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        skipped
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(d.taken_at)}
                    {d.dose_taken ? ` · ${d.dose_taken}` : ""}
                  </p>
                  {d.notes ? (
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">{d.notes}</p>
                  ) : null}
                </div>
                <form action={deleteDose.bind(null, d.id)}>
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                    aria-label="Delete this dose"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Banner({ kind, children }: { kind: "ok" | "warn"; children: React.ReactNode }) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100";
  return <p className={`rounded-md px-3 py-2 text-sm ${cls}`}>{children}</p>;
}
