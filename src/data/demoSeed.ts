import { STATUS_TODO, type Task } from "@shared/types";
import { DEMO_ROWS } from "@shared/demoRows";
import { addDays, today } from "@/lib/dates";

/** Local-first mod için başlangıç kartları (bkz. shared/demoRows.ts). */
export function demoSeed(): Task[] {
  const t0 = today();
  const now = new Date().toISOString();
  return DEMO_ROWS.map((r, i) => ({
    id: `demo-${String(i + 1).padStart(2, "0")}`,
    title: r.title,
    area: r.area,
    status: r.status ?? STATUS_TODO,
    priority: r.priority ?? null,
    date: r.offset === null || r.offset === undefined ? null : addDays(t0, r.offset),
    dateEnd: null,
    duration: r.duration ?? null,
    note: r.note ?? "",
    dayLabel: null,
    url: null,
    createdTime: now,
    lastEditedTime: now,
  }));
}
