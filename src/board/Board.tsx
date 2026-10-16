import { memo, useEffect, useRef, useState } from "react";
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
import type { Schema, Task, TaskPatch } from "@shared/types";
import { TaskCard } from "@/components/TaskCard";
import { QuickAdd } from "@/components/QuickAdd";
import { formatDuration } from "@/lib/format";
import type { Lane } from "./layouts";
import "./Board.css";

interface Props {
  lanes: Lane[];
  schema: Schema;
  showNotes: boolean;
  empty: string | null;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onDrop: (t: Task, patch: TaskPatch) => void;
  onQuickAdd: (title: string, patch: TaskPatch) => void;
  onNewWithDraft: (draft: TaskPatch & { title?: string }) => void;
}

const LANE_TILTS = [-0.7, 0.5, -0.4, 0.6, -0.5, 0.4, -0.6, 0.5];

/** Tek mantar pano: odak değişince şeritler yeniden dizilir; kartlar sürüklenerek şerit değiştirir. */
export function Board({ lanes, schema, showNotes, empty, onOpen, onToggleDone, onDrop, onQuickAdd, onNewWithDraft }: Props) {
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current?.task as Task | undefined) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const task = e.active.data.current?.task as Task | undefined;
    const lane = lanes.find((l) => l.id === e.over?.id);
    if (!task || !lane?.drop || lane.tasks.some((t) => t.id === task.id)) return;
    onDrop(task, lane.drop);
  };

  /* Telefon: görünen şerit → alttaki noktalar */
  const viewRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.querySelector<HTMLElement>(".lane");
      const w = first ? first.offsetWidth + 16 : 1;
      setCurrent(Math.round(el.scrollLeft / w));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [lanes.length]);

  return (
    <section id="pano" className="board" aria-label="Pano">
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div ref={viewRef} className="board__view">
          <div className="board__lanes">
            {lanes.map((lane, i) => (
              <LaneView
                key={lane.id}
                lane={lane}
                tilt={LANE_TILTS[i % LANE_TILTS.length]}
                schema={schema}
                showNotes={showNotes}
                onOpen={onOpen}
                onToggleDone={onToggleDone}
                onQuickAdd={onQuickAdd}
                onNewWithDraft={onNewWithDraft}
              />
            ))}
          </div>
          {empty && <p className="board__empty">{empty}</p>}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.34,1.3,.64,1)" }}>
          {active ? <TaskCard task={active} schema={schema} showNote={showNotes} onOpen={() => {}} onToggleDone={() => {}} dragging /> : null}
        </DragOverlay>
      </DndContext>
      <span className="board__hint" aria-hidden>
        SÜRÜKLE · KAYDIR
      </span>
      <span className="board__dots" aria-hidden>
        {lanes.map((l, i) => (
          <i key={l.id} className={i === current ? "is-on" : undefined} />
        ))}
      </span>
    </section>
  );
}

const LaneView = memo(function LaneView({
  lane,
  tilt,
  schema,
  showNotes,
  onOpen,
  onToggleDone,
  onQuickAdd,
  onNewWithDraft,
}: {
  lane: Lane;
  tilt: number;
  schema: Schema;
  showNotes: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onQuickAdd: (title: string, patch: TaskPatch) => void;
  onNewWithDraft: (draft: TaskPatch & { title?: string }) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.id, disabled: !lane.drop });
  return (
    <section
      ref={setNodeRef}
      className={`lane ${isOver ? "is-over" : ""}`}
      data-tone={lane.tone}
      aria-label={lane.sub ? `${lane.title} · ${lane.sub}` : lane.title}
      style={{ "--lane-c": lane.color, "--lane-tilt": `${tilt}deg` } as React.CSSProperties}
    >
      <header className="lane__label">
        <i className="lane__dot" aria-hidden />
        <h2 className="lane__title">{lane.title}</h2>
        {lane.sub && <span className="lane__sub">{lane.sub}</span>}
        <span className="lane__count" aria-label={`${lane.tasks.length} kart`}>
          {lane.tasks.length}
        </span>
        {lane.totalMinutes > 0 && <span className="lane__min">{formatDuration(lane.totalMinutes)}</span>}
      </header>
      <div className="lane__cards">
        {lane.tasks.map((t) => (
          <DraggableCard key={t.id} task={t} schema={schema} showNote={showNotes} onOpen={onOpen} onToggleDone={onToggleDone} />
        ))}
        {lane.tasks.length === 0 && <div className="lane__empty">{lane.empty}</div>}
      </div>
      {lane.add && (
        <QuickAdd
          label="Kart ekle"
          onAdd={(title) => onQuickAdd(title, lane.add!)}
          onMore={(title) => onNewWithDraft({ ...lane.add, title })}
        />
      )}
    </section>
  );
});

function DraggableCard({ task, schema, showNote, onOpen, onToggleDone }: { task: Task; schema: Schema; showNote: boolean; onOpen: (t: Task) => void; onToggleDone: (t: Task) => void }) {
  // Yalnızca işaretçi dinleyicileri: kartın kendisi zaten odaklanabilir bir düğme (article role=button)
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: task.id, data: { task } });
  return (
    <div ref={setNodeRef} {...listeners} className={`card-slot ${isDragging ? "is-ghost" : ""}`}>
      <TaskCard task={task} schema={schema} showNote={showNote} onOpen={onOpen} onToggleDone={onToggleDone} />
    </div>
  );
}
