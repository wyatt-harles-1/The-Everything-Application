import Link from "next/link";

import { MedicationForm } from "../MedicationForm";
import { createMedication } from "../actions";

export default function NewMedicationPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/log/medication" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Back to medications
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Add medication
        </h1>
      </header>

      <MedicationForm action={createMedication} submitLabel="Save medication" />
    </div>
  );
}
