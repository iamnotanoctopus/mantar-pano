/** Tarih yardımcıları — tüm tarihler yerel saat diliminde "YYYY-MM-DD" olarak tutulur. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** iso - today (gün cinsinden) */
export function diffDays(iso: string, base = today()): number {
  const a = fromISODate(iso).getTime();
  const b = fromISODate(base).getTime();
  return Math.round((a - b) / 86_400_000);
}

const fmtWeekdayLong = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });
const fmtWeekdayShort = new Intl.DateTimeFormat("tr-TR", { weekday: "short" });
const fmtDayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
const fmtDayMonthYear = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const fmtLong = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" });
const fmtMonthYear = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

export const weekdayLong = (iso: string) => fmtWeekdayLong.format(fromISODate(iso));
export const weekdayShort = (iso: string) => fmtWeekdayShort.format(fromISODate(iso));
export const dayMonth = (iso: string) => fmtDayMonth.format(fromISODate(iso));
export const dayMonthYear = (iso: string) => fmtDayMonthYear.format(fromISODate(iso));
export const longDate = (iso: string) => fmtLong.format(fromISODate(iso));
export const monthYear = (d: Date) => fmtMonthYear.format(d);
export const timeOf = (isoDateTime: string) => fmtTime.format(new Date(isoDateTime));

export type DayTone = "overdue" | "today" | "soon" | "later" | "none";

/**
 * Notion'daki "Gün" formülünün karşılığı: tarihe göre insan okunur, göreli etiket.
 *   gecikmiş → "3 gün gecikti" / "Dün"
 *   bugün    → "Bugün", yarın → "Yarın"
 *   6 güne kadar → haftanın günü ("Cumartesi")
 *   sonrası  → "24 Eki" (yıl farklıysa yıl eklenir)
 */
export function dayLabel(iso: string | null, base = today()): { label: string; tone: DayTone } {
  if (!iso) return { label: "", tone: "none" };
  const diff = diffDays(iso, base);
  if (diff < 0) {
    return { label: diff === -1 ? "Dün" : `${-diff} gün gecikti`, tone: "overdue" };
  }
  if (diff === 0) return { label: "Bugün", tone: "today" };
  if (diff === 1) return { label: "Yarın", tone: "soon" };
  if (diff <= 6) return { label: weekdayLong(iso), tone: "soon" };
  const sameYear = iso.slice(0, 4) === base.slice(0, 4);
  return { label: sameYear ? dayMonth(iso) : dayMonthYear(iso), tone: "later" };
}

/** Pazartesi ile başlayan haftanın ilk günü */
export function startOfWeek(iso: string): string {
  const d = fromISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Pzt=0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

/** "20–26 Ekim" gibi hafta aralığı etiketi */
/**
 * "12–18 Ekim"; iki aya yayılan haftada kapsül genişlemesin diye kısa ay adlarıyla "26 Eki – 1 Kas".
 * `long`: ekran okuyucu için her zaman tam ay adları.
 */
export function weekRangeLabel(weekStart: string, long = false): string {
  const end = addDays(weekStart, 6);
  const s = fromISODate(weekStart);
  const e = fromISODate(end);
  const full = new Intl.DateTimeFormat("tr-TR", { month: "long" });
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${full.format(e)}`;
  const month = long ? full : new Intl.DateTimeFormat("tr-TR", { month: "short" });
  return `${s.getDate()} ${month.format(s)} – ${e.getDate()} ${month.format(e)}`;
}

/** "5 dk önce" gibi göreli zaman */
export function relativeTime(isoDateTime: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(isoDateTime).getTime());
  const s = Math.round(diff / 1000);
  if (s < 10) return "az önce";
  if (s < 60) return `${s} sn önce`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.round(h / 24)} gün önce`;
}
