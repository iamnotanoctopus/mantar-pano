import { useMemo, useState } from "react";
import type { Schema, Task } from "@shared/types";
import { TaskCard } from "@/components/TaskCard";
import { QuickAdd } from "@/components/QuickAdd";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { fromISODate, longDate, monthYear, toISODate, today } from "@/lib/dates";
import { colorVar, plural } from "@/lib/format";
import { isDone, matchesSearch, tasksByDate } from "@/lib/views";
import { Group, ViewHead } from "./shared";

interface Props {
  tasks: Task[];
  schema: Schema;
  query: string;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onQuickAdd: (title: string, date: string) => void;
}

const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MAX_CHIPS = 3;

function monthGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Pazartesi = 0
  const start = new Date(year, month, 1 - offset);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(toISODate(d));
  }
  // Son satır tamamen sonraki aya aitse at
  const lastRowStart = cells[35];
  if (fromISODate(lastRowStart).getMonth() !== month) return cells.slice(0, 35);
  return cells;
}

export function CalendarView({ tasks, schema, query, onOpen, onToggleDone, onQuickAdd }: Props) {
  const t0 = today();
  const [cursor, setCursor] = useState(() => {
    const d = fromISODate(t0);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState<string>(t0);

  const filtered = useMemo(() => tasks.filter((t) => matchesSearch(t, query)), [tasks, query]);
  const byDate = useMemo(() => tasksByDate(filtered), [filtered]);
  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const monthLabel = monthYear(new Date(cursor.y, cursor.m, 1));
  const monthCount = cells.filter((d) => fromISODate(d).getMonth() === cursor.m).reduce((s, d) => s + (byDate.get(d)?.length ?? 0), 0);

  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    const d = fromISODate(t0);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(t0);
  };

  const dayTasks = byDate.get(selected) ?? [];

  return (
    <section className="view">
      <ViewHead title="Takvim" sub={`${monthLabel} · ${plural(monthCount, "kart")}`}>
        <div className="cal__nav">
          <button className="btn btn--icon btn--sm" onClick={() => move(-1)} aria-label="Önceki ay">
            <IconChevronLeft />
          </button>
          <button className="btn btn--sm" onClick={goToday}>
            Bugün
          </button>
          <button className="btn btn--icon btn--sm" onClick={() => move(1)} aria-label="Sonraki ay">
            <IconChevronRight />
          </button>
        </div>
      </ViewHead>

      <div className="cal">
        <div className="cal__grid" role="grid" aria-label={monthLabel}>
          {DOW.map((d) => (
            <div key={d} className="cal__dow" role="columnheader">
              {d}
            </div>
          ))}
          {cells.map((iso) => {
            const d = fromISODate(iso);
            const outside = d.getMonth() !== cursor.m;
            const list = byDate.get(iso) ?? [];
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            const cls = ["cal__cell", outside && "is-outside", iso === t0 && "is-today", iso === selected && "is-selected", weekend && "is-weekend"]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={iso}
                className={cls}
                role="gridcell"
                tabIndex={0}
                aria-selected={iso === selected}
                onClick={() => setSelected(iso)}
                onKeyDown={(e) => e.key === "Enter" && setSelected(iso)}
              >
                <span className="cal__day">{d.getDate()}</span>
                {list.slice(0, MAX_CHIPS).map((t) => {
                  const area = schema.areas.find((a) => a.name === t.area);
                  return (
                    <button
                      key={t.id}
                      className={`cal__chip ${isDone(t) ? "is-done" : ""}`}
                      style={{ "--c": colorVar(area?.color) } as React.CSSProperties}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(t);
                      }}
                      title={t.title}
                    >
                      {t.title}
                    </button>
                  );
                })}
                {list.length > MAX_CHIPS && <span className="cal__more">+{list.length - MAX_CHIPS} daha</span>}
                <span className="cal__dots">
                  {list.slice(0, 5).map((t) => {
                    const area = schema.areas.find((a) => a.name === t.area);
                    return <span key={t.id} className="cal__dot" style={{ "--c": colorVar(area?.color), opacity: isDone(t) ? 0.4 : 1 } as React.CSSProperties} />;
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Group title={longDate(selected)} count={dayTasks.length} tone={selected === t0 ? "today" : undefined}>
        {dayTasks.map((t) => (
          <TaskCard key={t.id} task={t} schema={schema} variant="list" showArea showNote={false} onOpen={onOpen} onToggleDone={onToggleDone} />
        ))}
        {dayTasks.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Bu güne iğnelenmiş kart yok.</p>}
        <QuickAdd label="Bu güne kart ekle" onAdd={(title) => onQuickAdd(title, selected)} />
      </Group>
    </section>
  );
}
