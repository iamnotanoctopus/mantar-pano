/** Görünüm temaları — CSS tarafı src/styles/themes/* (scripts/themes.mjs'den üretilir). */
export type SkinId = "mantar" | "msn" | "kumsal" | "cyberpunk";

export interface SkinDef {
  id: SkinId;
  label: string;
  hint: string;
  /** Ayarlar panelindeki küçük renk örneği */
  swatch: [string, string, string];
}

export const SKINS: SkinDef[] = [
  { id: "mantar", label: "Mantar", hint: "Kâğıt kartlar, mantar zemin, sıcak tonlar", swatch: ["#d9bb93", "#fffdf8", "#2f4f80"] },
  { id: "msn", label: "Retro MSN", hint: "Windows XP mavisi, Messenger yeşili, Tahoma", swatch: ["#3e86e6", "#ffffff", "#4aa72c"] },
  { id: "kumsal", label: "Kumsal", hint: "Kum, deniz ve gün batımı", swatch: ["#eadcbd", "#0f7f93", "#e3842f"] },
  { id: "cyberpunk", label: "Cyberpunk", hint: "Neon macenta ve camgöbeği, ızgara zemin", swatch: ["#070b15", "#19e3ff", "#ff2bd6"] },
];

export const isSkin = (v: unknown): v is SkinId => SKINS.some((s) => s.id === v);
