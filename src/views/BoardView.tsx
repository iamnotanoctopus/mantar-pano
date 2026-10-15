import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Schema, Task } from "@shared/types";
import { TaskCard } from "@/components/TaskCard";
import { QuickAdd } from "@/components/QuickAdd";
import { colorVar, formatDuration } from "@/lib/format";
import { boardTasks, groupByArea, matchesSearch, type AreaGroup } from "@/lib/views";

interface Props {
  tasks: Task[];
  schema: Schema;
  query: string;
  showNotes: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onQuickAdd: (title: string, area: string | null) => void;
  onNewWithDraft: (draft: { title?: string; area?: string | null }) => void;
  onMoveArea: (task: Task, area: string | null) => void;
}

const NONE = "__none__";
const colId = (area: string | null) => `col:${area ?? NONE}`;
const areaOf = (id: string) => (id.startsWith("col:") ? (id.slice(4) === NONE ? null : id.slice(4)) : undefined);

export function BoardView({ tasks, schema, query, showNotes, onOpen, onToggleDone, onQuickAdd, onNewWithDraft, onMoveArea }: Props) {
  const groups = useMemo(() => groupByArea(boardTasks(tasks).filter((t) => matchesSearch(t, query)), schema), [tasks, schema, query]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? tasks.find((t) => t.id === activeId) : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const task = tasks.find((t) => t.id === e.active.id);
    if (!task || !e.over) return;
    const area = areaOf(String(e.over.id));
    if (area === undefined || area === task.area) return;
    onMoveArea(task, area);
  };

  const total = groups.reduce((s, g) => s + g.tasks.length, 0);

  /* Mobil: hangi sütun görünüyor → üstteki alan çipi */
  const colsRef = useRef<HTMLDivElement>(null);
  const [activeCol, setActiveCol] = useState(0);
  useEffect(() => {
    const el = colsRef.current;
    if (!el) return;
    const onScroll = () => {
      const w = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 12 : 1;
      setActiveCol(Math.round(el.scrollLeft / w));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [groups.length]);
  const scrollToCol = (i: number) => {
    const el = colsRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - 10, behavior: "smooth" });
  };

  return (
    <section className="board-wrap">
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="board">
          <div className="board__inner">
            <div className="board__areas" role="tablist" aria-label="Alanlar">
              {groups.map((g, i) => {
                const opt = schema.areas.find((a) => a.name === g.area);
                return (
                  <button
                    key={g.area ?? NONE}
                    role="tab"
                    aria-selected={activeCol === i}
                    className={`board__area ${activeCol === i ? "is-active" : ""}`}
                    style={{ "--c": colorVar(opt?.color) } as React.CSSProperties}
                    onClick={() => scrollToCol(i)}
                  >
                    {g.area ?? "Alansız"} <small>{g.tasks.length}</small>
                  </button>
                );
              })}
            </div>
            <div className="board__cols" ref={colsRef}>
              {groups.map((g) => (
                <Column
                  key={g.area ?? NONE}
                  group={g}
                  schema={schema}
                  showNotes={showNotes}
                  onOpen={onOpen}
                  onToggleDone={onToggleDone}
                  onQuickAdd={onQuickAdd}
                  onNewWithDraft={onNewWithDraft}
                />
              ))}
            </div>
            {total === 0 && (
              <p className="board__note">
                {query ? "Aramana uyan kart yok." : "Bu hafta için iğnelenmiş kart yok — bir sütuna kart ekleyerek başla."}
              </p>
            )}
          </div>
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.7,.2,1)" }}>
          {active ? <TaskCard task={active} schema={schema} showNote={showNotes} onOpen={() => {}} onToggleDone={() => {}} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}

function Column({
  group,
  schema,
  showNotes,
  onOpen,
  onToggleDone,
  onQuickAdd,
  onNewWithDraft,
}: {
  group: AreaGroup;
  schema: Schema;
  showNotes: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onQuickAdd: (title: string, area: string | null) => void;
  onNewWithDraft: (draft: { title?: string; area?: string | null }) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colId(group.area) });
  const opt = schema.areas.find((a) => a.name === group.area);

  return (
    <div ref={setNodeRef} className={`col ${isOver ? "is-over" : ""}`} style={{ "--c": colorVar(opt?.color) } as React.CSSProperties}>
      <header className="col__head">
        <span className="col__dot" />
        <h3>{group.area ?? "Alansız"}</h3>
        <span className="col__count">{group.tasks.length}</span>
        {group.totalMinutes > 0 && <span className="col__min">{formatDuration(group.totalMinutes)}</span>}
      </header>
      <div className="col__cards">
        {group.tasks.map((t) => (
          <DraggableCard key={t.id} task={t} schema={schema} showNote={showNotes} onOpen={onOpen} onToggleDone={onToggleDone} />
        ))}
        {group.tasks.length === 0 && <div className="col__empty">Buraya kart iğnele</div>}
      </div>
      <QuickAdd onAdd={(title) => onQuickAdd(title, group.area)} onMore={(title) => onNewWithDraft({ title, area: group.area })} />
    </div>
  );
}

function DraggableCard({
  task,
  schema,
  showNote,
  onOpen,
  onToggleDone,
}: {
  task: Task;
  schema: Schema;
  showNote: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: task.id, data: { task } });
  return (
    <div ref={setNodeRef} {...listeners} className={isDragging ? "card-ghost" : undefined}>
      <TaskCard task={task} schema={schema} showNote={showNote} onOpen={onOpen} onToggleDone={onToggleDone} />
    </div>
  );
}
