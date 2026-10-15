import { STATUS_DONE, type Schema, type Task } from "@shared/types";
import { addDays, startOfWeek, today } from "./dates";
import { fold } from "./format";

/**
 * Notion'daki görünümlerin kuralları birebir burada:
 *   📌 Pano        : Bitti değil ∧ (Tarih ≤ bugün+7 ∨ Tarih boş) · Alan'a göre grupla · Tarih ↑
 *   ☀️ Bugün       : Bitti değil ∧ Tarih ≤ bugün · Öncelik ↑
 *   🗓 Yaklaşanlar : Bitti değil ∧ Tarih > bugün+7 · Tarih ↑
 *   📅 Takvim      : Tarih'e göre
 */

export type ViewId = "board" | "today" | "upcoming" | "calendar" | "all";

export interface ViewDef {
  id: ViewId;
  label: string;
  short: string;
  hint: string;
}

export const VIEWS: ViewDef[] = [
  { id: "board", label: "Pano", short: "Pano", hint: "Bu hafta ve tarihsiz kartlar, alanlara göre" },
  { id: "today", label: "Bugün", short: "Bugün", hint: "Bugün ve gecikenler, önceliğe göre" },
  { id: "upcoming", label: "Yaklaşanlar", short: "Yakında", hint: "Bir haftadan uzak kartlar" },
  { id: "calendar", label: "Takvim", short: "Takvim", hint: "Aylık görünüm" },
  { id: "all", label: "Tümü", short: "Tümü", hint: "Bitenler dahil her şey" },
];

export const isDone = (t: Task) => t.status === STATUS_DONE;

export function priorityRank(priority: string | null, schema: Schema): number {
  const i = schema.priorities.findIndex((p) => p.name === priority);
  return i < 0 ? schema.priorities.length : i;
}

export const byDate = (a: Task, b: Task) => (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99");

export function byPriorityThenDate(schema: Schema) {
  return (a: Task, b: Task) => priorityRank(a.priority, schema) - priorityRank(b.priority, schema) || byDate(a, b);
}

export function matchesSearch(t: Task, q: string): boolean {
  if (!q) return true;
  const needle = fold(q.trim());
  return fold(t.title).includes(needle) || fold(t.note).includes(needle) || fold(t.area ?? "").includes(needle);
}

export interface Horizon {
  today: string;
  weekAhead: string;
}

export const horizon = (): Horizon => {
  const t = today();
  return { today: t, weekAhead: addDays(t, 7) };
};

/* ------------------------------------------------------------- Pano */

export function boardTasks(tasks: Task[], h = horizon()): Task[] {
  return tasks.filter((t) => !isDone(t) && (t.date === null || t.date <= h.weekAhead)).sort(byDate);
}

export interface AreaGroup {
  area: string | null;
  tasks: Task[];
  totalMinutes: number;
}

export function groupByArea(tasks: Task[], schema: Schema): AreaGroup[] {
  const groups: AreaGroup[] = schema.areas.map((a) => ({ area: a.name, tasks: [], totalMinutes: 0 }));
  const other: AreaGroup = { area: null, tasks: [], totalMinutes: 0 };
  for (const t of tasks) {
    const g = groups.find((x) => x.area === t.area) ?? other;
    g.tasks.push(t);
    g.totalMinutes += t.duration ?? 0;
  }
  if (other.tasks.length) groups.push(other);
  return groups;
}

/* ------------------------------------------------------------ Bugün */

export interface TodayBuckets {
  overdue: Task[];
  today: Task[];
  totalMinutes: number;
}

export function todayTasks(tasks: Task[], schema: Schema, h = horizon()): TodayBuckets {
  const cmp = byPriorityThenDate(schema);
  const due = tasks.filter((t) => !isDone(t) && t.date !== null && t.date <= h.today);
  const overdue = due.filter((t) => t.date! < h.today).sort(cmp);
  const todays = due.filter((t) => t.date === h.today).sort(cmp);
  return {
    overdue,
    today: todays,
    totalMinutes: due.reduce((s, t) => s + (t.duration ?? 0), 0),
  };
}

/* ------------------------------------------------------ Yaklaşanlar */

export interface WeekGroup {
  weekStart: string;
  tasks: Task[];
}

export function upcomingTasks(tasks: Task[], h = horizon()): WeekGroup[] {
  const list = tasks.filter((t) => !isDone(t) && t.date !== null && t.date > h.weekAhead).sort(byDate);
  const map = new Map<string, Task[]>();
  for (const t of list) {
    const ws = startOfWeek(t.date!);
    if (!map.has(ws)) map.set(ws, []);
    map.get(ws)!.push(t);
  }
  return [...map.entries()].map(([weekStart, tasks]) => ({ weekStart, tasks }));
}

/* ------------------------------------------------------------ Tümü */

export interface AllFilters {
  status: string | "open" | "all";
  area: string | "all";
  priority: string | "all";
}

export function allTasks(tasks: Task[], f: AllFilters): Task[] {
  return tasks
    .filter((t) => {
      if (f.status === "open") return !isDone(t);
      if (f.status !== "all") return t.status === f.status;
      return true;
    })
    .filter((t) => f.area === "all" || t.area === f.area)
    .filter((t) => f.priority === "all" || t.priority === f.priority)
    .sort(byDate);
}

/* ---------------------------------------------------------- Takvim */

export function tasksByDate(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.date) continue;
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date)!.push(t);
  }
  return map;
}
