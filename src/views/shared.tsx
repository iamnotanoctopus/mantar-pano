import type { ReactNode } from "react";
import { formatDuration } from "@/lib/format";
import { IconPinOutline } from "@/components/icons";
import "./views.css";

export function ViewHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="view__head">
      <div>
        <h2 className="view__title">{title}</h2>
        {sub && <p className="view__sub">{sub}</p>}
      </div>
      {children && <div className="view__tools">{children}</div>}
    </header>
  );
}

export function Group({
  title,
  count,
  minutes,
  tone,
  children,
}: {
  title: string;
  count?: number;
  minutes?: number;
  tone?: "overdue" | "today" | "muted";
  children: ReactNode;
}) {
  return (
    <section className={`group ${tone ? `group--${tone}` : ""}`}>
      <header className="group__head">
        <h3 className="group__title">{title}</h3>
        {count !== undefined && <span className="group__count">{count}</span>}
        {minutes ? <span className="group__min">{formatDuration(minutes)}</span> : null}
      </header>
      <div className="group__list">{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <IconPinOutline width={28} height={28} />
      <p className="empty__title">{title}</p>
      {hint && <p className="empty__hint">{hint}</p>}
      {children}
    </div>
  );
}
