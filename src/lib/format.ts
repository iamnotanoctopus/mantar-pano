import type { NotionColor } from "@shared/types";

/** 30 → "30 dk", 60 → "1 sa", 90 → "1 sa 30 dk" */
export function formatDuration(min: number | null | undefined): string {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h} sa ${m} dk`;
  if (h) return `${h} sa`;
  return `${m} dk`;
}

/** Notion renk adını CSS değişkenine çevirir. */
export function colorVar(color: NotionColor | undefined | null): string {
  return `var(--c-${color ?? "gray"})`;
}

export function plural(n: number, one: string, many = one): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Arama için Türkçe'ye duyarlı küçük harf */
export function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

/** Tasarım sistemindeki dört alanın token'ı (alan-is, alan-gorunurluk, alan-okul, alan-kisisel). */
const AREA_TOKENS: Record<string, string> = {
  is: "--alan-is",
  gorunurluk: "--alan-gorunurluk",
  okul: "--alan-okul",
  kisisel: "--alan-kisisel",
};

/** "Görünürlük" → "gorunurluk": Türkçe küçük harf, aksanlar atılır */
export function slug(s: string): string {
  return fold(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Alanın rengi: tasarımın dört alanı tema token'ından (temaya göre değişir),
 * diğerleri (ör. Notion'da sonradan eklenen "Ajan") Notion seçenek renginden.
 */
export function areaColor(name: string | null | undefined, notionColor?: NotionColor | null): string {
  const token = name ? AREA_TOKENS[slug(name)] : undefined;
  return token ? `var(${token})` : colorVar(notionColor);
}
