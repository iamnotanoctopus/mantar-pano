import { motion } from "motion/react";
import { PINS, type PinFill } from "@/lib/brand";
import { LIFT, PIN_POP, PIN_SPRING } from "@/lib/physics";
import type { PinShape } from "@/lib/themes";
import { usePrefs } from "@/state/prefs";

const FILL: Record<PinFill, string> = { sapka: "var(--raptiye-sapka)", benek: "var(--raptiye-benek)", igne: "var(--raptiye-igne)" };

/**
 * Kart raptiyesi. Biçim temadan gelir (amanita = mini mantar, classic-cork = kırmızı küre,
 * cupertino-glass = yassı metalik, midnight-wood = pastel disk) ya da ayarlardaki raptiye stilinden.
 * Kartın üst ortasında durur; dekoratiftir (aria-hidden).
 * `pop`: kart bırakıldı / eklendi → raptiye 1.2 → 1.0 sekerek saplanır (yay 520/18).
 */
export function Pin({ shape, className, pop }: { shape?: PinShape; className?: string; pop?: boolean }) {
  const { resolvedPin } = usePrefs();
  const parts = PINS[shape ?? resolvedPin];
  return (
    <motion.svg
      key={pop ? "pop" : "rest"}
      className={className ?? "pin"}
      viewBox="0 0 22 30"
      width="22"
      height="30"
      aria-hidden
      focusable="false"
      initial={pop ? { scale: PIN_POP, y: LIFT.pinRise } : false}
      animate={{ scale: 1, y: 0 }}
      transition={PIN_SPRING}
    >
      {parts.map((p, i) => {
        const common = { fill: FILL[p.fill], opacity: p.opacity };
        if (p.el === "path") return <path key={i} d={p.d} {...common} />;
        if (p.el === "circle") return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} {...common} />;
        return <rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} {...common} />;
      })}
    </motion.svg>
  );
}
