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
