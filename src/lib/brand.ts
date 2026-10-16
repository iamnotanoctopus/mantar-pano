/**
 * Amanita raptiye kimliği: logo ve kart raptiyelerinin geometrisi (tasarım sistemi §2, Notion talimatı §4).
 * Logo.tsx, Pin.tsx ve scripts/build-icons.mjs aynı kaynaktan çizer; renkler token'dan gelir.
 */
import type { PinShape } from "./themes";

/** Logo: Amanita muscaria şapkası + metal raptiye iğnesi. viewBox 0 0 64 80 */
export const LOGO = {
  viewBox: "0 0 64 80",
  cap: "M5 30C5 14 17 5 32 5s27 9 27 25c0 3-3 4-6 4H11c-3 0-6-1-6-4z",
  /** Şapka altı (lameller); kart kenarı tonunda */
  gill: "M9 34h46c0 3-5 5-23 5S9 37 9 34z",
  /** [cx, cy, rx, ry] */
  spots: [
    [20, 17, 4.2, 3.4],
    [35, 11, 3.2, 2.6],
    [45, 21, 4.6, 3.6],
    [29, 26, 3, 2.4],
    [13, 27, 2.4, 2],
  ] as const,
  stem: "M25 39h14l-2 13c0 2-2 3-5 3s-5-1-5-3z",
  needle: "M30.5 55h3l-1.1 22h-.8z",
  collar: { x: 27, y: 53.5, width: 10, height: 3, rx: 1.5 },
};

interface PinPaint {
  /** "none": yalnızca kontur (ör. Midnight raptiyesinin iç halkası) */
  fill: PinFill | "none";
  stroke?: PinFill;
  strokeWidth?: number;
  opacity?: number;
}
export type PinPart =
  | ({ el: "path"; d: string } & PinPaint)
  | ({ el: "circle"; cx: number; cy: number; r: number } & PinPaint)
  | ({ el: "rect"; x: number; y: number; width: number; height: number; rx?: number } & PinPaint);

/** Raptiye renkleri token adıdır: CSS'te var(--raptiye-…) */
export type PinFill = "sapka" | "benek" | "igne";

/**
 * Kart raptiyeleri: viewBox 0 0 22 30; temaya (ya da seçilen raptiye stiline) göre dört biçim.
 * İğnenin yalnızca başın altındaki kısa ucu çizilir (gerisi kâğıda saplı; başlığın üstüne inmez).
 */
export const PINS: Record<PinShape, PinPart[]> = {
  amanita: [
    { el: "path", d: "M2 11C2 5 6 2 11 2s9 3 9 9c0 1.5-1 2-2 2H4c-1 0-2-.5-2-2z", fill: "sapka" },
    { el: "circle", cx: 7, cy: 7, r: 1.6, fill: "benek" },
    { el: "circle", cx: 13, cy: 5, r: 1.2, fill: "benek" },
    { el: "circle", cx: 16, cy: 9, r: 1.5, fill: "benek" },
    { el: "path", d: "M8 13h6l-.7 5H8.7z", fill: "benek" },
    { el: "path", d: "M10.4 18h1.2l-.3 3h-.6z", fill: "igne" },
  ],
  classic: [
    { el: "circle", cx: 11, cy: 9, r: 7.5, fill: "sapka" },
    { el: "circle", cx: 8.5, cy: 6.5, r: 2.2, fill: "benek", opacity: 0.8 },
    { el: "path", d: "M10.4 16h1.2l-.3 5h-.6z", fill: "igne" },
  ],
  glass: [
    { el: "rect", x: 5, y: 3, width: 12, height: 7, rx: 2, fill: "sapka" },
    { el: "rect", x: 7, y: 10, width: 8, height: 3, fill: "igne" },
    { el: "rect", x: 6.5, y: 4.3, width: 3, height: 1.2, rx: 0.6, fill: "benek", opacity: 0.9 },
    { el: "path", d: "M10.5 13h1l-.2 8h-.6z", fill: "igne" },
  ],
  midnight: [
    { el: "circle", cx: 11, cy: 9, r: 7, fill: "sapka" },
    { el: "circle", cx: 11, cy: 9, r: 3.6, fill: "none", stroke: "benek", strokeWidth: 1.4, opacity: 0.75 },
    { el: "path", d: "M10.4 16h1.2l-.3 5h-.6z", fill: "igne" },
  ],
};

export interface BrandColors {
  sapka: string;
  benek: string;
  igne: string;
  /** Şapka altı */
  kenar: string;
}

/** Bağımsız SVG metni (uygulama ikonları için; tarayıcı dışında da çalışır). */
export function logoSvg(c: BrandColors, opts: { background?: string; size?: number; padding?: number } = {}): string {
  const size = opts.size ?? 64;
  const pad = opts.padding ?? 0;
  const spots = LOGO.spots.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c.benek}"/>`).join("");
  const mark = `<path d="${LOGO.cap}" fill="${c.sapka}"/><path d="${LOGO.gill}" fill="${c.kenar}"/>${spots}<path d="${LOGO.stem}" fill="${c.benek}"/><path d="${LOGO.needle}" fill="${c.igne}"/><rect x="${LOGO.collar.x}" y="${LOGO.collar.y}" width="${LOGO.collar.width}" height="${LOGO.collar.height}" rx="${LOGO.collar.rx}" fill="${c.igne}"/>`;
  if (!opts.background) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO.viewBox}" width="${(size * 64) / 80}" height="${size}">${mark}</svg>`;
  // Kare ikon: logo (64×80) ortalanır, `pad` oranında kenar boşluğu bırakılır
  const inner = 100 * (1 - 2 * pad);
  const scale = inner / 80;
  const tx = (100 - 64 * scale) / 2;
  const ty = (100 - 80 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><rect width="100" height="100" rx="22" fill="${opts.background}"/><g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${mark}</g></svg>`;
}
