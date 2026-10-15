import { useMemo } from "react";
import type { Schema, Task } from "@shared/types";
import { TaskCard } from "@/components/TaskCard";
import { QuickAdd } from "@/components/QuickAdd";
import { IconPlus } from "@/components/icons";
import { longDate, today } from "@/lib/dates";
import { formatDuration, plural } from "@/lib/format";
import { byPriorityThenDate, horizon, isDone, matchesSearch, todayTasks } from "@/lib/views";
import { EmptyState, Group, ViewHead } from "./shared";

interface Props {
  tasks: Task[];
  schema: Schema;
  query: string;
  showNotes: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onQuickAdd: (title: string, date: string) => void;
  onNew: () => void;
}

export function TodayView({ tasks, schema, query, showNotes, onOpen, onToggleDone, onQuickAdd, onNew }: Props) {
  const t0 = today();
  const filtered = useMemo(() => tasks.filter((t) => matchesSearch(t, query)), [tasks, query]);
  const buckets = useMemo(() => todayTasks(filtered, schema), [filtered, schema]);
  const doneToday = useMemo(() => filtered.filter((t) => isDone(t) && t.date === t0), [filtered, t0]);
  /* Sıradakiler: bu hafta içinde, bugünden sonraki ilk kartlar */
  const nextUp = useMemo(() => {
    const h = horizon();
    return filtered
      .filter((t) => !isDone(t) && t.date !== null && t.date > h.today && t.date <= h.weekAhead)
      .sort((a, b) => a.date!.localeCompare(b.date!) || byPriorityThenDate(schema)(a, b))
      .slice(0, 5);
  }, [filtered, schema]);
  const openCount = buckets.overdue.length + buckets.today.length;

  const sub =
    openCount === 0
      ? `${longDate(t0)} · açık kart yok`
      : `${longDate(t0)} · ${plural(openCount, "kart")}${buckets.totalMinutes ? ` · ${formatDuration(buckets.totalMinutes)}` : ""}`;

  return (
    <section className="view">
      <ViewHead title="Bugün" sub={sub}>
        <button className="btn hide-mobile" onClick={onNew}>
          <IconPlus /> Bugüne kart ekle
        </button>
      </ViewHead>

      {buckets.overdue.length > 0 && (
        <Group title="Gecikenler" count={buckets.overdue.length} tone="overdue" minutes={buckets.overdue.reduce((s, t) => s + (t.duration ?? 0), 0)}>
          {buckets.overdue.map((t) => (
            <TaskCard key={t.id} task={t} schema={schema} variant="list" showArea showNote={showNotes} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </Group>
      )}

      <Group title="Bugün" count={buckets.today.length} tone="today" minutes={buckets.today.reduce((s, t) => s + (t.duration ?? 0), 0)}>
        {buckets.today.map((t) => (
          <TaskCard key={t.id} task={t} schema={schema} variant="list" showArea showNote={showNotes} onOpen={onOpen} onToggleDone={onToggleDone} />
        ))}
        {buckets.today.length === 0 && (
          <EmptyState
            title={query ? "Aramana uyan kart yok." : buckets.overdue.length ? "Bugüne özel kart yok; önce gecikenler." : "Bugün için pano temiz."}
            hint={query ? undefined : "Bir kart ekle ya da panodan tarih ver."}
          />
        )}
        <QuickAdd label="Bugüne kart ekle" onAdd={(title) => onQuickAdd(title, t0)} />
      </Group>

      {nextUp.length > 0 && (
        <Group title="Sıradakiler" count={nextUp.length} tone="muted">
          {nextUp.map((t) => (
            <TaskCard key={t.id} task={t} schema={schema} variant="list" showArea showNote={false} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </Group>
      )}

      {doneToday.length > 0 && (
        <Group title="Bugün tamamlananlar" count={doneToday.length} tone="muted">
          {doneToday.map((t) => (
            <TaskCard key={t.id} task={t} schema={schema} variant="list" showArea showNote={false} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </Group>
      )}
    </section>
  );
}
