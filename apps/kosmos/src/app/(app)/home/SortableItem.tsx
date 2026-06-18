// A single draggable row in the home dashboard's edit mode. Shows the widget's
// label with a grip handle (drag to reorder) and an eye toggle (hide/show).
// Only rendered while editing — the actual widget content renders in normal
// mode, so this never needs the server-rendered node.

"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff } from "lucide-react";

export function SortableItem({
  id,
  label,
  hidden,
  onToggleHidden,
}: {
  id: string;
  label: string;
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-[var(--radius-card)] border border-border bg-surface p-3 shadow-soft"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${label} to reorder`}
        className="cursor-grab touch-none text-muted active:cursor-grabbing"
      >
        <GripVertical size={18} aria-hidden />
      </button>
      <span
        className={`flex-1 text-sm font-medium ${
          hidden ? "text-muted line-through" : "text-text"
        }`}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onToggleHidden}
        aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
        className="text-muted transition-colors hover:text-text"
      >
        {hidden ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}
