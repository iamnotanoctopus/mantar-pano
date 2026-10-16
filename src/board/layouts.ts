/**
 * Tek pano, üç odak. v1'deki beş sekmenin işi burada şeritlere dönüşür:
 *   Alanlar (1) → alan şeritleri         (v1 Pano: boardTasks + groupByArea)
 *   Bugün   (2) → Gecikenler · Bugün · Yarın (v1 Bugün: todayTasks)
 *   Hafta   (3) → Pzt … Paz + Tarihsiz   (v1 Yaklaşanlar/Takvim: haftaya göre gruplama)
 *   Tümü        → Süz (alan, öncelik, bitmişler) + Ara; her odakta çalışır
 * React'tan bağımsızdır; src/test/layouts.test.ts ile sınanır.
 */
import { DEFAULT_SCHEMA, type Schema, type Task, type TaskPatch } from "@shared/types";
import { addDays, dayMonth, startOfWeek, weekdayShort } from "@/lib/dates";
import { areaColor } from "@/lib/format";
import { byDate, byPriorityThenDate, horizon, isDone, matchesSearch, type Horizon } from "@/lib/views";
import type { Filters, Focus } from "@/state/prefsModel";

export interface Lane {
  id: string;
  title: string;
  /** Başlığın yanındaki küçük not (gün şeritlerinde tarih) */
  sub?: string;
  /** Şerit noktasının CSS rengi */
  color: string;
  tasks: Task[];
  totalMinutes: number;
  /** Bu şeride bırakılan karta uygulanacak değişiklik; null → bırakılamaz */
  drop: TaskPatch | null;
  /** Hızlı ekleme varsayılanları; null → hızlı ekleme yok */
  add: TaskPatch | null;
  tone?: "overdue" | "today";
  /** Boş şeritte görünen metin */
  empty: string;
}

export interface BoardLayout {
  lanes: Lane[];
  /** Panoda görünen kart sayısı */
  shown: number;
  /** Odak ya da süzgeç yüzünden görünmeyen kart sayısı ("N kart odak dışında") */
  hidden: number;
}

export interface LayoutInput {
  tasks: Task[];
  schema?: Schema;
  focus: Focus;
  filters: Filters;
  showDone: boolean;
  query: string;
  /** Hafta odağında gösterilen haftanın pazartesisi */
  weekStart: string;
  h?: Horizon;
}

const NONE = "__none__";
const minutes = (ts: Task[]) => ts.reduce((s, t) => s + (t.duration ?? 0), 0);
/** Bitenler şeridin sonunda */
const doneLast = (cmp: (a: Task, b: Task) => number) => (a: Task, b: Task) => Number(isDone(a)) - Number(isDone(b)) || cmp(a, b);

export const filtersActive = (f: Filters, showDone: boolean) => f.areas.length > 0 || f.priorities.length > 0 || showDone;

/** Süz + Ara: alan (çoklu), öncelik (çoklu), bitmişleri göster, metin araması */
export function applyFilters(tasks: Task[], f: { filters: Filters; showDone: boolean; query: string }): Task[] {
  return tasks.filter(
    (t) =>
      (f.showDone || !isDone(t)) &&
      (f.filters.areas.length === 0 || (t.area !== null && f.filters.areas.includes(t.area))) &&
      (f.filters.priorities.length === 0 || (t.priority !== null && f.filters.priorities.includes(t.priority))) &&
      matchesSearch(t, f.query),
  );
}

/**
 * Alanlar: v1 panosunun kuralı (tarih ≤ bugün+7 ya da tarihsiz). Arama yapılırken ufuk kalkar,
 * böylece "Tümü"nün işi (her kartı bulmak) aramayla görülür.
 */
export function byArea(tasks: Task[], schema: Schema, opts: { horizon: boolean; h?: Horizon }): Lane[] {
  const h = opts.h ?? horizon();
  const list = (opts.horizon ? tasks.filter((t) => t.date === null || t.date <= h.weekAhead) : tasks).slice().sort(doneLast(byDate));
  const lanes: Lane[] = schema.areas.map((a) => ({
    id: `area:${a.name}`,
    title: a.name,
    color: areaColor(a.name, a.color),
    tasks: [],
    totalMinutes: 0,
    drop: { area: a.name },
    add: { area: a.name },
    empty: "Buraya kart iğnele",
  }));
  const other: Lane = { id: `area:${NONE}`, title: "Alansız", color: "var(--c-gray)", tasks: [], totalMinutes: 0, drop: { area: null }, add: { area: null }, empty: "Alansız kart yok" };
  for (const t of list) (lanes.find((l) => l.title === t.area) ?? other).tasks.push(t);
  if (other.tasks.length) lanes.push(other);
  for (const l of lanes) l.totalMinutes = minutes(l.tasks);
  return lanes;
}

/** Bugün odağı: Gecikenler · Bugün · Yarın (öncelik ↑, sonra tarih) */
export function byToday(tasks: Task[], schema: Schema, h: Horizon = horizon()): Lane[] {
  const cmp = doneLast(byPriorityThenDate(schema));
  const tomorrow = addDays(h.today, 1);
  const overdue = tasks.filter((t) => !isDone(t) && t.date !== null && t.date < h.today).sort(cmp);
  const todays = tasks.filter((t) => t.date === h.today).sort(cmp);
  const tomorrows = tasks.filter((t) => t.date === tomorrow).sort(cmp);
  return [
    { id: "time:overdue", title: "Gecikenler", color: "var(--tehlike)", tasks: overdue, totalMinutes: minutes(overdue), drop: null, add: null, tone: "overdue", empty: "Geciken kart yok" },
    { id: "time:today", title: "Bugün", color: "var(--vurgu)", tasks: todays, totalMinutes: minutes(todays), drop: { date: h.today }, add: { date: h.today }, tone: "today", empty: "Bugün için pano temiz" },
    { id: "time:tomorrow", title: "Yarın", color: "var(--vurgu-2)", tasks: tomorrows, totalMinutes: minutes(tomorrows), drop: { date: tomorrow }, add: { date: tomorrow }, empty: "Yarına kart yok" },
  ];
}

/** Hafta odağı: seçili haftanın günleri (Pzt … Paz) ve en sağda Tarihsiz */
export function byWeek(tasks: Task[], schema: Schema, weekStart: string, h: Horizon = horizon()): Lane[] {
  const cmp = doneLast(byPriorityThenDate(schema));
  const ws = startOfWeek(weekStart);
  const lanes: Lane[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(ws, i);
    const ts = tasks.filter((t) => t.date === day).sort(cmp);
    const isToday = day === h.today;
    return {
      id: `day:${day}`,
      title: weekdayShort(day).replace(".", ""),
      sub: isToday ? "Bugün" : dayMonth(day),
      color: isToday ? "var(--vurgu)" : day < h.today ? "var(--murekkep-3)" : "var(--vurgu-2)",
      tasks: ts,
      totalMinutes: minutes(ts),
      drop: { date: day },
      add: { date: day },
      tone: isToday ? "today" : undefined,
      empty: day < h.today ? "Geçti" : "Boş gün",
    };
  });
  const undated = tasks.filter((t) => t.date === null).sort(cmp);
  lanes.push({ id: "day:none", title: "Tarihsiz", color: "var(--murekkep-3)", tasks: undated, totalMinutes: minutes(undated), drop: { date: null, dateEnd: null }, add: {}, empty: "Tarihsiz kart yok" });
  return lanes;
}

/** Odak + süzgeç → şeritler ve "odak dışında" sayısı */
export function buildLayout(input: LayoutInput): BoardLayout {
  const schema = input.schema ?? DEFAULT_SCHEMA;
  const h = input.h ?? horizon();
  const filtered = applyFilters(input.tasks, input);
  const lanes =
    input.focus === "today"
      ? byToday(filtered, schema, h)
      : input.focus === "week"
        ? byWeek(filtered, schema, input.weekStart, h)
        : byArea(filtered, schema, { horizon: !input.query.trim(), h });
  const shown = lanes.reduce((s, l) => s + l.tasks.length, 0);
  const universe = input.showDone ? input.tasks.length : input.tasks.filter((t) => !isDone(t)).length;
  return { lanes, shown, hidden: Math.max(0, universe - shown) };
}
