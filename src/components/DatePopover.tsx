import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Schema, Task } from "@shared/types";
import { fromISODate, monthYear, startOfWeek, toISODate, today } from "@/lib/dates";
import { areaColor } from "@/lib/format";
import { isDone, tasksByDate } from "@/lib/views";
import { useDismiss } from "@/hooks/useDismiss";
import { IconChevronLeft, IconChevronRight } from "./icons";
import "./DatePopover.css";

const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** v1 Takvim görünümünün ay ızgarası: Pazartesi başlar, son satır tamamen sonraki aydaysa atılır. */
export function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(toISODate(d));
  }
  return fromISODate(cells[35]).getMonth() !== month ? cells.slice(0, 35) : cells;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Popover'ı açan düğmeler (masaüstü kapsülü ve telefon gezgini) */
  anchorRefs: RefObject<HTMLElement | null>[];
  weekStart: string;
  onPick: (iso: string) => void;
  tasks: Task[];
  schema: Schema;
}

/** Hafta odağının tarih şeridi: ay ızgarası popover'ı. Gün seçilince pano o haftaya kayar. */
export function DatePopover({ open, onClose, anchorRefs, weekStart, onPick, tasks, schema }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, onClose, anchorRefs);
  const t0 = today();
  const [cursor, setCursor] = useState(() => {
    const d = fromISODate(weekStart);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    if (!open) return;
    const d = fromISODate(weekStart);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    // açılınca seçili haftanın ilk gününe odaklan
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(".cal__cell.is-week")?.focus());
  }, [open, weekStart]);

  const byDate = useMemo(() => tasksByDate(tasks), [tasks]);
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  if (!open) return null;

  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const label = monthYear(new Date(cursor.y, cursor.m, 1));

  return (
    <>
      <div className="sheet-scrim" aria-hidden onClick={onClose} />
      <div ref={ref} className="cal" role="dialog" aria-label={`Takvim · ${label}`}>
        <i className="sheet-grip" aria-hidden />
        <div className="cal__head">
          <button type="button" className="cal__nav" onClick={() => move(-1)} aria-label="Önceki ay">
            <IconChevronLeft width={16} height={16} />
          </button>
          <h2 className="cal__title">{label}</h2>
          <button type="button" className="cal__nav" onClick={() => move(1)} aria-label="Sonraki ay">
            <IconChevronRight width={16} height={16} />
          </button>
        </div>
        <div className="cal__grid" role="grid" aria-label={label}>
          {DOW.map((d) => (
            <span key={d} className="cal__dow" role="columnheader">
              {d}
            </span>
          ))}
          {cells.map((iso) => {
            const d = fromISODate(iso);
            const list = byDate.get(iso) ?? [];
            const inWeek = startOfWeek(iso) === weekStart;
            const cls = ["cal__cell", d.getMonth() !== cursor.m && "is-outside", iso === t0 && "is-today", inWeek && "is-week"].filter(Boolean).join(" ");
            return (
              <button
                key={iso}
                type="button"
                role="gridcell"
                className={cls}
                aria-selected={inWeek}
                aria-label={`${d.getDate()} ${label}${list.length ? `, ${list.length} kart` : ""}`}
                onClick={() => {
                  onPick(iso);
                  onClose();
                }}
              >
                <span className="cal__day">{d.getDate()}</span>
                <span className="cal__dots" aria-hidden>
                  {list.slice(0, 4).map((t) => {
                    const a = schema.areas.find((x) => x.name === t.area);
                    return <i key={t.id} style={{ background: areaColor(t.area, a?.color), opacity: isDone(t) ? 0.4 : 1 }} />;
                  })}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="cal__today"
          onClick={() => {
            onPick(t0);
            onClose();
          }}
        >
          Bu hafta
        </button>
      </div>
    </>
  );
}
