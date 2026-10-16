import { PINS, type PinFill } from "@/lib/brand";
import type { PinShape } from "@/lib/themes";
import { usePrefs } from "@/state/prefs";

const FILL: Record<PinFill, string> = { sapka: "var(--raptiye-sapka)", benek: "var(--raptiye-benek)", igne: "var(--raptiye-igne)" };

/**
 * Kart raptiyesi. Biçim temadan gelir (amanita = mini mantar, classic-cork = kırmızı küre,
 * cupertino-glass = yassı metalik, midnight-wood = pastel disk) ya da ayarlardaki raptiye stilinden.
 * Kartın üst ortasında durur; dekoratiftir (aria-hidden).
 */
export function Pin({ shape, className }: { shape?: PinShape; className?: string }) {
  const { resolvedPin } = usePrefs();
  const parts = PINS[shape ?? resolvedPin];
  return (
    <svg className={className ?? "pin"} viewBox="0 0 22 30" width="22" height="30" aria-hidden focusable="false">
      {parts.map((p, i) => {
        const common = { fill: FILL[p.fill], opacity: p.opacity };
        if (p.el === "path") return <path key={i} d={p.d} {...common} />;
        if (p.el === "circle") return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} {...common} />;
        return <rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} {...common} />;
      })}
    </svg>
  );
}
