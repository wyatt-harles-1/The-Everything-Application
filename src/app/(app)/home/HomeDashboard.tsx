// Client wrapper around the home widgets. Normal mode renders each widget's
// (server-rendered) node in the user's saved order, skipping hidden ones. Edit
// mode swaps in a compact draggable list (dnd-kit) to reorder + hide/show, then
// persists via saveHomeLayout. Data stays on the server — the widget `node`s
// are passed in as opaque ReactNodes; the drag UI only deals with ids/labels.

"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Pencil, Check } from "lucide-react";

import { saveHomeLayout } from "@/lib/home/actions";

import { SortableItem } from "./SortableItem";

export type HomeWidget = { id: string; label: string; node: ReactNode };

export function HomeDashboard({
  widgets,
  initialOrder,
  initialHidden,
}: {
  widgets: HomeWidget[];
  initialOrder: string[];
  initialHidden: string[];
}) {
  const presentIds = useMemo(() => widgets.map((w) => w.id), [widgets]);
  const byId = useMemo(
    () => new Map(widgets.map((w) => [w.id, w])),
    [widgets],
  );

  // Seed order from saved layout, restricted to widgets that actually have
  // content this render, with any newcomers appended.
  const [order, setOrder] = useState<string[]>(() => {
    const fromSaved = initialOrder.filter((id) => presentIds.includes(id));
    const rest = presentIds.filter((id) => !fromSaved.includes(id));
    return [...fromSaved, ...rest];
  });
  const [hidden, setHidden] = useState<string[]>(() =>
    initialHidden.filter((id) => presentIds.includes(id)),
  );
  const [editing, setEditing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function toggleHidden(id: string) {
    setHidden((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function finishEditing() {
    setEditing(false);
    // Fire-and-forget; the in-session state is already applied, so a failed
    // persist (e.g. table not migrated yet) just means it won't survive reload.
    void saveHomeLayout({ order, hidden });
  }

  if (editing) {
    return (
      <div className="space-y-[var(--gap-section)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Drag to reorder · tap the eye to hide</p>
          <button
            type="button"
            onClick={finishEditing}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-card)] bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg"
          >
            <Check size={14} aria-hidden /> Done
          </button>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {order.map((id) => {
                const w = byId.get(id);
                if (!w) return null;
                return (
                  <SortableItem
                    key={id}
                    id={id}
                    label={w.label}
                    hidden={hidden.includes(id)}
                    onToggleHidden={() => toggleHidden(id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  const visible = order.filter((id) => !hidden.includes(id));

  return (
    <div className="space-y-[var(--gap-section)]">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-text"
        >
          <Pencil size={14} aria-hidden /> Customize
        </button>
      </div>
      {visible.map((id) => (
        <div key={id}>{byId.get(id)?.node}</div>
      ))}
    </div>
  );
}
