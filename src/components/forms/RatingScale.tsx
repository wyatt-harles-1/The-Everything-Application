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
              flex h-11 cursor-pointer items-center justify-center
              rounded-md border border-zinc-300 bg-white text-sm
              transition-colors
              hover:border-zinc-400 hover:bg-zinc-50
              peer-checked:border-zinc-950 peer-checked:bg-zinc-950 peer-checked:text-white
              peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-950 peer-focus-visible:ring-offset-1
              dark:border-zinc-700 dark:bg-zinc-900
              dark:hover:border-zinc-500 dark:hover:bg-zinc-800
              dark:peer-checked:border-zinc-50 dark:peer-checked:bg-zinc-50 dark:peer-checked:text-zinc-950
            "
          >
            {n}
          </span>
        </label>
      ))}
    </div>
  );
}
