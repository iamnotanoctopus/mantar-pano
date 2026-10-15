import { useMemo, useState } from "react";
import type { Schema, Task } from "@shared/types";
import { TaskCard } from "@/components/TaskCard";
import { colorVar, formatDuration, plural } from "@/lib/format";
import { allTasks, matchesSearch, type AllFilters } from "@/lib/views";
import { EmptyState, ViewHead } from "./shared";

interface Props {
  tasks: Task[];
  schema: Schema;
  query: string;
  showNotes: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
}

export function AllView({ tasks, schema, query, showNotes, onOpen, onToggleDone }: Props) {
  const [f, setF] = useState<AllFilters>({ status: "open", area: "all", priority: "all" });
  const list = useMemo(() => allTasks(tasks.filter((t) => matchesSearch(t, query)), f), [tasks, query, f]);
  const minutes = list.reduce((s, t) => s + (t.duration ?? 0), 0);

  return (
    <section className="view">
      <ViewHead title="Tümü" sub={`${plural(list.length, "kart")}${minutes ? ` · ${formatDuration(minutes)}` : ""} · ${tasks.length} toplam`} />

      <div className="filters">
        <div className="filters__group">
          <span className="filters__label">Durum</span>
          <div className="chips">
            <button className="chip chip--plain" aria-pressed={f.status === "open"} onClick={() => setF({ ...f, status: "open" })}>
              Açık
            </button>
            {schema.statuses.map((s) => (
              <button
                key={s.name}
                className="chip"
                style={{ "--c": colorVar(s.color) } as React.CSSProperties}
                aria-pressed={f.status === s.name}
                onClick={() => setF({ ...f, status: f.status === s.name ? "open" : s.name })}
              >
                {s.name}
              </button>
            ))}
            <button className="chip chip--plain" aria-pressed={f.status === "all"} onClick={() => setF({ ...f, status: "all" })}>
              Hepsi
            </button>
          </div>
        </div>
        <div className="filters__group">
          <span className="filters__label">Alan</span>
          <div className="chips">
            {schema.areas.map((a) => (
              <button
                key={a.name}
                className="chip"
                style={{ "--c": colorVar(a.color) } as React.CSSProperties}
                aria-pressed={f.area === a.name}
                onClick={() => setF({ ...f, area: f.area === a.name ? "all" : a.name })}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <div className="filters__group">
          <span className="filters__label">Öncelik</span>
          <div className="chips">
            {schema.priorities.map((p) => (
              <button
                key={p.name}
                className="chip"
                style={{ "--c": colorVar(p.color) } as React.CSSProperties}
                aria-pressed={f.priority === p.name}
                onClick={() => setF({ ...f, priority: f.priority === p.name ? "all" : p.name })}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="group__list">
        {list.map((t) => (
          <TaskCard key={t.id} task={t} schema={schema} variant="list" showArea showNote={showNotes} onOpen={onOpen} onToggleDone={onToggleDone} />
        ))}
        {list.length === 0 && <EmptyState title="Bu filtrelere uyan kart yok." />}
      </div>
    </section>
  );
}
