import { memo, type MouseEvent } from "react";
import { STATUS_DOING, STATUS_DONE, type Schema, type Task } from "@shared/types";
import { dayLabel } from "@/lib/dates";
import { colorVar, formatDuration } from "@/lib/format";
import { IconCheck, IconClock } from "./icons";
import { Pin } from "./Pin";
import "./TaskCard.css";

export interface TaskCardProps {
  task: Task;
  schema: Schema;
  /** board: alan sütununda, iğneli ve hafif eğik · list: düz liste satırı */
  variant?: "board" | "list";
  showNote?: boolean;
  showArea?: boolean;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  dragging?: boolean;
}

export const TaskCard = memo(function TaskCard({
  task,
  schema,
  variant = "board",
  showNote = true,
  showArea = false,
  onOpen,
  onToggleDone,
  dragging,
}: TaskCardProps) {
  const area = schema.areas.find((a) => a.name === task.area);
  const priority = schema.priorities.find((p) => p.name === task.priority);
  const done = task.status === STATUS_DONE;
  const doing = task.status === STATUS_DOING;
  const day = dayLabel(task.date);
  const dur = formatDuration(task.duration);

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleDone(task);
  };

  const cls = [
    "card",
    `card--${variant}`,
    done && "card--done",
    doing && "card--doing",
    dragging && "card--dragging",
    day.tone === "overdue" && !done && "card--overdue",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={cls}
      style={{ "--c": colorVar(area?.color) } as React.CSSProperties}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={task.title}
    >
      {variant === "board" && <Pin />}
      <div className="card__main">
        <button
          type="button"
          className="card__check"
          onClick={toggle}
          aria-label={done ? "Yeniden aç" : "Tamamlandı olarak işaretle"}
          aria-pressed={done}
          title={done ? "Yeniden aç" : doing ? "Sürüyor — tamamla" : "Tamamla"}
        >
          <IconCheck width={13} height={13} strokeWidth={2.6} />
        </button>
        <div className="card__body">
          <h4 className="card__title">{task.title || <span className="muted">Adsız kart</span>}</h4>
          {(day.label || dur || priority || (showArea && area)) && (
            <div className="card__meta">
              {day.label && <span className={`tag tag--day tag--${day.tone}`}>{day.label}</span>}
              {dur && (
                <span className="tag tag--dur">
                  <IconClock />
                  {dur}
                </span>
              )}
              {priority && (
                <span className="tag tag--dot" style={{ "--c": colorVar(priority.color) } as React.CSSProperties}>
                  {priority.name}
                </span>
              )}
              {showArea && area && (
                <span className="tag tag--dot" style={{ "--c": colorVar(area.color) } as React.CSSProperties}>
                  {area.name}
                </span>
              )}
            </div>
          )}
          {showNote && task.note && <p className="card__note">{task.note}</p>}
        </div>
      </div>
    </article>
  );
});
