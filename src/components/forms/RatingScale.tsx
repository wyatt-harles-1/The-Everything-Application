// 1-N rating scale (default 1-10) rendered as a row of radio buttons styled
// like number tiles. Pure HTML radios + Tailwind peer-checked classes - no
// client state needed, works without JS, accessible by default.
//
// Wraps in a horizontal-scroll container if the screen is narrower than the
// row; in practice 1-10 fits on a 390px screen with the sizing below.

export function RatingScale({
  name,
  min = 1,
  max = 10,
  required,
  defaultValue,
}: {
  name: string;
  min?: number;
  max?: number;
  required?: boolean;
  defaultValue?: number;
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div
      role="radiogroup"
      aria-label={`${name} rating`}
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
    >
      {values.map((n) => (
        <label key={n} className="flex-1 min-w-[2.5rem]">
          <input
            type="radio"
            name={name}
            value={n}
            required={required}
            defaultChecked={defaultValue === n}
            className="peer sr-only"
          />
          <span
            className="
              flex h-[var(--control-h)] cursor-pointer items-center justify-center
              rounded-[var(--radius-card)] border border-border bg-surface text-sm text-text
              transition-colors
              hover:border-accent hover:bg-hover
              peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-fg
              peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1
            "
          >
            {n}
          </span>
        </label>
      ))}
    </div>
  );
}
