/**
 * Tercih modeli ve v1 → v2 göçü (React'tan bağımsız; test edilir).
 *
 * v1 (`mp.prefs`): { theme: "system"|"light"|"dark", skin: "mantar"|"msn"|"kumsal"|"cyberpunk",
 *                    view: "board"|"today"|"upcoming"|"calendar"|"all", showNotes, sound, nudgeOnOverdue }
 * v2 (`mp.prefs`, v: 2): tema artık dört tasarım temasından biri (ya da "system");
 *                    görünüm sekmesi yok, yerine tek panonun odağı ve süzgeci var.
 */
import { isThemePref, type PinShape, type TextureId, type ThemePref } from "@/lib/themes";

export type Focus = "areas" | "today" | "week";
export type TexturePref = "auto" | TextureId;
export type PinPref = "auto" | PinShape;

export interface Filters {
  /** Boş dizi = tüm alanlar */
  areas: string[];
  /** Boş dizi = tüm öncelikler */
  priorities: string[];
}

export interface Prefs {
  v: 2;
  theme: ThemePref;
  texture: TexturePref;
  pinStyle: PinPref;
  showNotes: boolean;
  sound: boolean;
  nudgeOnOverdue: boolean;
  focus: Focus;
  filters: Filters;
  showDone: boolean;
}

export const FOCUSES: Focus[] = ["areas", "today", "week"];
const TEXTURES: TexturePref[] = ["auto", "mantar", "ahsap", "cam", "duz"];
const PINS: PinPref[] = ["auto", "amanita", "classic", "glass", "midnight"];

export const DEFAULT_PREFS: Prefs = {
  v: 2,
  theme: "amanita",
  texture: "auto",
  pinStyle: "auto",
  showNotes: true,
  sound: true,
  nudgeOnOverdue: true,
  focus: "areas",
  filters: { areas: [], priorities: [] },
  showDone: false,
};

const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

/** v1 görünümünün v2'deki karşılığı (Eşleme tablosu: Pano→Alanlar, Bugün→Bugün, Yaklaşanlar/Takvim→Hafta, Tümü→Alanlar). */
const FOCUS_FROM_VIEW: Record<string, Focus> = { board: "areas", today: "today", upcoming: "week", calendar: "week", all: "areas" };

/**
 * Kayıtlı tercihi v2'ye çevirir.
 *  - kayıt yoksa varsayılan; claude.ai görüntüleyicisi koyu temadaysa (`hostTheme === "dark"`) Midnight Wood,
 *  - v1 kaydı: skin → theme (mantar ve diğerleri → classic-cork; v1'de açıkça "dark" seçildiyse midnight-wood),
 *    view kalkar (odak olarak taşınır), texture/pinStyle/filters/showDone varsayılanla eklenir,
 *  - v2 kaydı: alan alan doğrulanır, bozuk değerler varsayılana döner.
 */
export function migratePrefs(raw: unknown, hostTheme?: string): Prefs {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PREFS, filters: { areas: [], priorities: [] }, theme: hostTheme === "dark" ? "midnight-wood" : DEFAULT_PREFS.theme };
  }
  const r = raw as Record<string, unknown>;
  const common = {
    showNotes: bool(r.showNotes, DEFAULT_PREFS.showNotes),
    sound: bool(r.sound, DEFAULT_PREFS.sound),
    nudgeOnOverdue: bool(r.nudgeOnOverdue, DEFAULT_PREFS.nudgeOnOverdue),
  };

  if (r.v !== 2) {
    return {
      ...DEFAULT_PREFS,
      ...common,
      theme: r.theme === "dark" ? "midnight-wood" : "classic-cork",
      focus: FOCUS_FROM_VIEW[String(r.view)] ?? "areas",
      filters: { areas: [], priorities: [] },
    };
  }

  const f = (r.filters ?? {}) as Record<string, unknown>;
  return {
    v: 2,
    ...common,
    theme: isThemePref(r.theme) ? r.theme : DEFAULT_PREFS.theme,
    texture: oneOf(r.texture, TEXTURES, "auto"),
    pinStyle: oneOf(r.pinStyle, PINS, "auto"),
    focus: oneOf(r.focus, FOCUSES, "areas"),
    filters: { areas: strings(f.areas), priorities: strings(f.priorities) },
    showDone: bool(r.showDone, false),
  };
}
