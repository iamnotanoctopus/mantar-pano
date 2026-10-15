import { useMemo } from "react";
import type { Schema, Task } from "@shared/types";
import { TaskCard } from "@/components/TaskCard";
import { addDays, startOfWeek, today, weekRangeLabel } from "@/lib/dates";
import { formatDuration, plural } from "@/lib/format";
import { matchesSearch, upcomingTasks } from "@/lib/views";
import { EmptyState, Group, ViewHead } from "./shared";

interface Props {
  tasks: Task[];
  schema: Schema;
  query: string;
  showNotes: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
}

export function UpcomingView({ tasks, schema, query, showNotes, onOpen, onToggleDone }: Props) {
  const weeks = useMemo(() => upcomingTasks(tasks.filter((t) => matchesSearch(t, query))), [tasks, query]);
  const count = weeks.reduce((s, w) => s + w.tasks.length, 0);
  const minutes = weeks.reduce((s, w) => s + w.tasks.reduce((x, t) => x + (t.duration ?? 0), 0), 0);
  const nextWeek = startOfWeek(addDays(today(), 7));

  return (
    <section className="view">
      <ViewHead title="Yaklaşanlar" sub={count ? `Bir haftadan sonrası · ${plural(count, "kart")} · ${formatDuration(minutes)}` : "Bir haftadan sonrası için plan yok"} />
      {weeks.length === 0 && <EmptyState title={query ? "Aramana uyan kart yok." : "Ufukta kart yok."} hint="Tarihi bir haftadan ileri olan kartlar burada toplanır." />}
      {weeks.map((w) => (
        <Group
          key={w.weekStart}
          title={w.weekStart === nextWeek ? `Gelecek hafta · ${weekRangeLabel(w.weekStart)}` : weekRangeLabel(w.weekStart)}
          count={w.tasks.length}
          minutes={w.tasks.reduce((s, t) => s + (t.duration ?? 0), 0)}
        >
          {w.tasks.map((t) => (
            <TaskCard key={t.id} task={t} schema={schema} variant="list" showArea showNote={showNotes} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </Group>
      ))}
    </section>
  );
}
