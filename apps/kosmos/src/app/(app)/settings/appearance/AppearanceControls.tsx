// Live appearance pickers. Each selection (1) optimistically mutates the
// <html> attributes so the whole app re-skins instantly, and (2) calls the
// updatePreferences server action to persist to the cookie + DB. No save
// button — changes apply on tap.

"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { updatePreferences } from "@/lib/preferences/actions";
import {
  THEMES,
  ACCENTS,
  DENSITIES,
  type Preferences,
  type Theme,
  type Accent,
  type Density,
} from "@/lib/preferences/schema";

const THEME_LABELS: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
  amoled: "AMOLED",
};

const DENSITY_LABELS: Record<Density, string> = {
  comfortable: "Comfortable",
  compact: "Compact",
};

const ACCENT_SWATCH: Record<Accent, string> = {
  indigo: "#4f46e5",
  emerald: "#059669",
  rose: "#e11d48",
  amber: "#d97706",
  violet: "#7c3aed",
  sky: "#0284c7",
};

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.setAttribute("data-theme-pref", theme);
  if (theme === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    el.setAttribute("data-theme", dark ? "dark" : "light");
  } else {
    el.setAttribute("data-theme", theme);
  }
}

function tileClass(active: boolean): string {
  return `flex min-h-[var(--control-h)] items-center justify-between gap-2 rounded-[var(--radius-card)] border px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-border bg-surface text-text hover:bg-hover"
  }`;
}

export function AppearanceControls({ initial }: { initial: Preferences }) {
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [, startTransition] = useTransition();

  function update(patch: Partial<Preferences>) {
    setPrefs((p) => ({ ...p, ...patch }));

    // Optimistic, instant re-skin.
    if (patch.theme) applyTheme(patch.theme);
    if (patch.accent)
      document.documentElement.setAttribute("data-accent", patch.accent);
    if (patch.density)
      document.documentElement.setAttribute("data-density", patch.density);

    // Persist (cookie always; DB best-effort).
    startTransition(() => {
      void updatePreferences(patch);
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Theme</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update({ theme: t })}
              className={tileClass(prefs.theme === t)}
            >
              <span>{THEME_LABELS[t]}</span>
              {prefs.theme === t ? <Check size={16} aria-hidden /> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Accent</h2>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => {
            const active = prefs.accent === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => update({ accent: a })}
                aria-label={a}
                aria-pressed={active}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95"
                style={{
                  backgroundColor: ACCENT_SWATCH[a],
                  boxShadow: active
                    ? `0 0 0 2px var(--bg), 0 0 0 4px ${ACCENT_SWATCH[a]}`
                    : undefined,
                }}
              >
                {active ? <Check size={18} color="#fff" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Density</h2>
        <div className="grid grid-cols-2 gap-2">
          {DENSITIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => update({ density: d })}
              className={tileClass(prefs.density === d)}
            >
              <span>{DENSITY_LABELS[d]}</span>
              {prefs.density === d ? <Check size={16} aria-hidden /> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
