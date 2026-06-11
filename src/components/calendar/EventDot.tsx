// A small colored dot marking a day has items. Goals use the warn token (a
// deadline), everything else the accent. Presentational — usable from server or
// client trees.

import { cn } from "@/lib/cn";

export function EventDot({
  kind,
  className,
}: {
  kind: "event" | "goal";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        kind === "goal" ? "bg-warn" : "bg-accent",
        className,
      )}
    />
  );
}
