/**
 * Mantar Pano v2 temaları. Renkler ve gölgeler design/tokens.json'dan üretilen
 * src/styles/themes/*.css dosyalarındadır; burada yalnızca seçim ve önizleme bilgisi var.
 */
export type ThemeId = "amanita" | "classic-cork" | "cupertino-glass" | "midnight-wood";
/** Tercih: belirli bir tema ya da işletim sistemine göre (açıkta Amanita, koyuda Midnight Wood). */
export type ThemePref = ThemeId | "system";
export type TextureId = "mantar" | "ahsap" | "cam" | "duz";
export type PinShape = "amanita" | "classic" | "glass" | "midnight";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  short: string;
  hint: string;
  dark: boolean;
  /** Tema seçicideki küçük önizleme: pano, kart, vurgu */
  swatch: { board: string; card: string; accent: string };
  texture: TextureId;
  pin: PinShape;
}

export const THEMES: ThemeDef[] = [
  {
    id: "amanita",
    label: "Amanita — Şirinler Ormanı",
    short: "Amanita",
    hint: "Yosun alt tonlu mantar, krem parşömen, benekli mantar raptiye",
    dark: false,
    swatch: { board: "#c6ae78", card: "#fbf4e3", accent: "#dc2626" },
    texture: "mantar",
    pin: "amanita",
  },
  {
    id: "classic-cork",
    label: "Klasik Mantar Pano",
    short: "Klasik",
    hint: "Gerçekçi mantar, kırık beyaz kâğıt, kırmızı küre raptiye",
    dark: false,
    swatch: { board: "#d9bb93", card: "#fffdf8", accent: "#2f4f80" },
    texture: "mantar",
    pin: "classic",
  },
  {
    id: "cupertino-glass",
    label: "Cupertino Glass",
    short: "Cupertino",
    hint: "Buzlu cam pano, yarı saydam kartlar, metalik raptiye",
    dark: false,
    swatch: { board: "#e5e5ea", card: "#ffffff", accent: "#0066cc" },
    texture: "cam",
    pin: "glass",
  },
  {
    id: "midnight-wood",
    label: "Midnight Wood",
    short: "Midnight",
    hint: "Koyu ceviz, sıcak koyu gri kartlar, pastel raptiye",
    dark: true,
    swatch: { board: "#2a1f17", card: "#322b26", accent: "#ffb454" },
    texture: "ahsap",
    pin: "midnight",
  },
];

export const DEFAULT_THEME: ThemeId = "amanita";
export const SYSTEM_DARK_THEME: ThemeId = "midnight-wood";

export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);
export const isThemePref = (v: unknown): v is ThemePref => v === "system" || isThemeId(v);
export const themeDef = (id: ThemeId): ThemeDef => THEMES.find((t) => t.id === id) ?? THEMES[0];

/** "system" tercihini işletim sisteminin açık/koyu moduna göre çözer. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): ThemeId {
  if (pref === "system") return systemDark ? SYSTEM_DARK_THEME : DEFAULT_THEME;
  return pref;
}
