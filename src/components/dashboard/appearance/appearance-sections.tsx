"use client";

import { arrayMove } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { copy } from "@/lib/copy";
import type { ThemeOptions } from "@/lib/customizer/theme-options";
import { cn } from "@/lib/utils";

const L = copy.appearance;
const sectionLabel = (id: string): string =>
  (L.sectionLabels as Record<string, string>)[id] ?? id;

type DragEndEvent = Parameters<
  NonNullable<ComponentProps<typeof DragDropProvider>["onDragEnd"]>
>[0];

export interface SectionEntry {
  id: string;
  visible: boolean;
}

/**
 * Daftar section (tab "Bagian"): reorder via drag (`@dnd-kit/react`) + tombol
 * panah ↑↓ (aksesibilitas & fallback), toggle tampil/sembunyi. Posisi terkunci
 * (`reorder:false`) & "wajib tampil" (`toggle:false`) tak bisa diubah — sesuai
 * options tema (server memvalidasi ulang; ini pengaman UX).
 */
export function SectionOrderList({
  options,
  sections,
  onChange,
}: {
  options: ThemeOptions;
  sections: SectionEntry[];
  onChange: (next: SectionEntry[]) => void;
}) {
  const opt = (id: string) => options.sections.find((s) => s.id === id);
  const canReorder = (id: string) => opt(id)?.reorder ?? false;
  const canToggle = (id: string) => opt(id)?.toggle ?? false;
  const homeIndex = (id: string) =>
    options.sections.findIndex((s) => s.id === id);

  // Terapkan hanya bila tak melanggar posisi terkunci (reorder:false wajib di
  // index bawaannya). Melanggar → abaikan (jaga urutan aman).
  const applyIfValid = (next: SectionEntry[]) => {
    for (let i = 0; i < next.length; i++) {
      const id = next[i]!.id;
      if (!canReorder(id) && homeIndex(id) !== i) return;
    }
    onChange(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) return;
    const { source } = event.operation;
    if (!isSortable(source)) return;
    const { initialIndex, index } = source;
    if (initialIndex === index) return;
    applyIfValid(arrayMove(sections, initialIndex, index));
  };

  const moveBy = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    if (!canReorder(sections[i]!.id) || !canReorder(sections[j]!.id)) return;
    applyIfValid(arrayMove(sections, i, j));
  };

  const toggle = (i: number) => {
    const s = sections[i]!;
    if (!canToggle(s.id)) return;
    const next = sections.slice();
    next[i] = { ...s, visible: !s.visible };
    onChange(next);
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <ul className="flex flex-col gap-1.5">
        {sections.map((s, i) => (
          <SortableRow
            key={s.id}
            id={s.id}
            index={i}
            label={sectionLabel(s.id)}
            visible={s.visible}
            reorderable={canReorder(s.id)}
            hideable={canToggle(s.id)}
            disableUp={
              i === 0 || !canReorder(s.id) || !canReorder(sections[i - 1]!.id)
            }
            disableDown={
              i === sections.length - 1 ||
              !canReorder(s.id) ||
              !canReorder(sections[i + 1]!.id)
            }
            onUp={() => moveBy(i, -1)}
            onDown={() => moveBy(i, 1)}
            onToggle={() => toggle(i)}
          />
        ))}
      </ul>
    </DragDropProvider>
  );
}

function SortableRow({
  id,
  index,
  label,
  visible,
  reorderable,
  hideable,
  disableUp,
  disableDown,
  onUp,
  onDown,
  onToggle,
}: {
  id: string;
  index: number;
  label: string;
  visible: boolean;
  reorderable: boolean;
  hideable: boolean;
  disableUp: boolean;
  disableDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onToggle: () => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
    disabled: !reorderable,
  });

  return (
    <li
      ref={ref}
      className={cn(
        "bg-background flex items-center gap-1 rounded-lg border px-1.5 py-1",
        isDragging && "shadow-md",
        !visible && "opacity-55",
      )}
    >
      <button
        ref={handleRef}
        type="button"
        aria-label={L.dragHandle}
        disabled={!reorderable}
        className="text-muted-foreground flex size-10 shrink-0 cursor-grab touch-none items-center justify-center disabled:cursor-default disabled:opacity-30"
      >
        {reorderable ? (
          <GripVertical className="size-4" />
        ) : (
          <Lock className="size-3.5" />
        )}
      </button>
      <span className="flex-1 truncate text-sm">{label}</span>
      <div className="flex items-center">
        <IconButton label={L.moveUp} onClick={onUp} disabled={disableUp}>
          <ArrowUp className="size-4" />
        </IconButton>
        <IconButton label={L.moveDown} onClick={onDown} disabled={disableDown}>
          <ArrowDown className="size-4" />
        </IconButton>
        {hideable ? (
          <IconButton label={visible ? L.hide : L.show} onClick={onToggle}>
            {visible ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
          </IconButton>
        ) : (
          <span
            className="text-muted-foreground px-1.5 text-[10px] tracking-wide uppercase"
            title={L.locked}
          >
            {L.locked}
          </span>
        )}
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground flex size-10 items-center justify-center rounded-md disabled:opacity-25"
    >
      {children}
    </button>
  );
}
