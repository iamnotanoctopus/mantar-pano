import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { INSTANT } from "@/lib/physics";
import type { Schema, Task } from "@shared/types";
import { addDays, fromISODate, monthYear, startOfWeek, toISODate, today } from "@/lib/dates";
import { areaColor } from "@/lib/format";
import { isDone, tasksByDate } from "@/lib/views";
import { firstVisible, useDismiss } from "@/hooks/useDismiss";
import { PHONE, useMediaQuery } from "@/hooks/useMediaQuery";
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

export const DATE_POPOVER_ID = "mp-takvim";

/**
 * Hafta odağının tarih şeridi: ay ızgarası popover'ı. Gün seçilince pano o haftaya (ve o günün şeridine) kayar.
 * Ok tuşları günler arasında gezer (ay sınırında ızgara da kayar); Esc ya da seçim odağı açan düğmeye geri verir.
 */
export function DatePopover({ open, onClose, anchorRefs, weekStart, onPick, tasks, schema }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const phone = useMediaQuery(PHONE);
  // Hareketi azalt: açılış/kapanış anında (MotionConfig yalnızca transform'ları kapatır, saydamlık yayı kalırdı)
  const instant = useReducedMotion() ? INSTANT : undefined;
  const back = () => firstVisible(anchorRefs);
  useDismiss(open, ref, onClose, anchorRefs, back);
  const t0 = today();
  const [cursor, setCursor] = useState(() => {
    const d = fromISODate(weekStart);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  /* Klavyeyle gezilen gün (ay değişince ızgara yeniden çizildikten sonra ona odaklanılır) */
  const [focusDay, setFocusDay] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const d = fromISODate(weekStart);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    // açılınca seçili haftanın ilk gününe odaklan (ızgara önce o aya dönsün diye odak efektiyle, çizimden sonra)
    setFocusDay(weekStart);
  }, [open, weekStart]);

  useEffect(() => {
    if (!focusDay) return;
    ref.current?.querySelector<HTMLElement>(`.cal__cell[data-day="${focusDay}"]`)?.focus();
    setFocusDay(null);
  }, [focusDay, cursor]);

  const byDate = useMemo(() => tasksByDate(tasks), [tasks]);
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const label = monthYear(new Date(cursor.y, cursor.m, 1));
  const pick = (iso: string) => {
    onPick(iso);
    onClose();
    back()?.focus();
  };
  const onCellKey = (e: KeyboardEvent<HTMLButtonElement>, iso: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = addDays(iso, step);
    if (!cells.includes(next) || fromISODate(next).getMonth() !== cursor.m) {
      const d = fromISODate(next);
      setCursor({ y: d.getFullYear(), m: d.getMonth() });
    }
    setFocusDay(next);
  };
  const off = phone ? { y: "100%" } : { opacity: 0, y: -6, scale: 0.96 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="scrim" className="sheet-scrim" aria-hidden onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={instant} />
      )}
      {open && (
      <motion.div
        key="cal"
        ref={ref}
        id={DATE_POPOVER_ID}
        className="cal"
        role="dialog"
        aria-label={`Takvim · ${label}`}
        initial={off}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={off}
        transition={instant}
      >
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
        <div className="cal__grid" role="group" aria-label={label}>
          {DOW.map((d) => (
            <span key={d} className="cal__dow" aria-hidden>
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
                className={cls}
                data-day={iso}
                aria-current={iso === t0 ? "date" : undefined}
                aria-label={`${d.getDate()} ${monthYear(d)}${inWeek ? ", seçili hafta" : ""}${list.length ? `, ${list.length} kart` : ""}`}
                onClick={() => pick(iso)}
                onKeyDown={(e) => onCellKey(e, iso)}
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
        <button type="button" className="cal__today" onClick={() => pick(t0)}>
          Bu hafta
        </button>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
