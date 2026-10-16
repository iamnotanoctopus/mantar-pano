import { memo, type MouseEvent } from "react";
import { STATUS_DOING, STATUS_DONE, type Schema, type Task } from "@shared/types";
import { dayLabel } from "@/lib/dates";
import { areaColor, formatDuration } from "@/lib/format";
import { stableKey } from "@/lib/stableKey";
import { IconCheck } from "./icons";
import { Pin } from "./Pin";
import "./TaskCard.css";

export interface TaskCardProps {
  task: Task;
  schema: Schema;
  showNote?: boolean;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  /** Sürükleme katmanındaki kopya: kaldırılmış hâl */
  dragging?: boolean;
  /** Kart az önce bırakıldı / eklendi: raptiye saplanır */
  pop?: boolean;
}

/** id'den sabit eğim: -0.9° … +0.9° (kâğıt elle iğnelenmiş gibi) */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.round(((((h % 2001) + 2001) % 2001) / 1000 - 1) * 90) / 100;
}

/**
 * Görev kartı: kâğıt, raptiye, onay düğmesi, başlık (Fraunces, 2 satır), meta satırı
 * (gün etiketi · süre · alan noktası + öncelik) ve isteğe bağlı not.
 * Hâller: dinlenme · tutuldu · bitti · gecikmiş (yalnızca etiket rengi ve raptiyenin eğikliği).
 */
export const TaskCard = memo(function TaskCard({ task, schema, showNote = true, onOpen, onToggleDone, dragging, pop }: TaskCardProps) {
  const area = schema.areas.find((a) => a.name === task.area);
  const done = task.status === STATUS_DONE;
  const doing = task.status === STATUS_DOING;
  const day = dayLabel(task.date);
  const dur = formatDuration(task.duration);
  const overdue = day.tone === "overdue" && !done;
  const metaLabel = task.priority ?? task.area;

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleDone(task);
  };

  const cls = ["card", done && "card--done", doing && "card--doing", dragging && "card--dragging", overdue && "card--overdue"].filter(Boolean).join(" ");

  return (
    <article
      className={cls}
      style={{ "--tilt": `${tilt(stableKey(task.id))}deg`, "--area-c": areaColor(task.area, area?.color) } as React.CSSProperties}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${task.title || "Adsız kart"}${day.label ? `, ${day.label}` : ""}${done ? ", bitti" : ""}`}
    >
      <Pin pop={pop} />
      <button
        type="button"
        className="card__check"
        onClick={toggle}
        aria-label={done ? "Yeniden aç" : "Tamamlandı olarak işaretle"}
        aria-pressed={done}
        title={done ? "Yeniden aç" : doing ? "Sürüyor — tamamla" : "Tamamla"}
      >
        <IconCheck width={12} height={12} strokeWidth={2.6} />
      </button>
      <h3 className="card__title">{task.title || <span className="muted">Adsız kart</span>}</h3>
      {(day.label || dur || metaLabel) && (
        <div className="card__meta">
          {day.label && <span className={`card__day card__day--${day.tone}`}>{day.label}</span>}
          {dur && <span className="card__dur">{dur}</span>}
          {metaLabel && (
            <span className="card__prio" title={task.area ?? undefined}>
              <i className="card__area" aria-hidden />
              {metaLabel}
            </span>
          )}
        </div>
      )}
      {showNote && task.note && <p className="card__note">{task.note}</p>}
    </article>
  );
});
