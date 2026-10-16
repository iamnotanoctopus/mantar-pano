import { useEffect, useLayoutEffect, useRef } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import { PINS, type PinFill } from "@/lib/brand";
import { LIFT, PIN_POP, PIN_SPRING } from "@/lib/physics";
import type { PinShape } from "@/lib/themes";
import { usePrefs } from "@/state/prefs";

const FILL: Record<PinFill | "none", string> = { sapka: "var(--raptiye-sapka)", benek: "var(--raptiye-benek)", igne: "var(--raptiye-igne)", none: "none" };

/**
 * Kart raptiyesi. Biçim temadan gelir (amanita = mini mantar, classic-cork = kırmızı küre,
 * cupertino-glass = yassı metalik, midnight-wood = pastel disk) ya da ayarlardaki raptiye stilinden.
 * Kartın üst ortasında durur; dekoratiftir (aria-hidden).
 * `pop`: kart bırakıldı / eklendi → raptiye 1.2 → 1.0 sekerek saplanır (yay 520/18).
 */
export function Pin({ shape, className, pop }: { shape?: PinShape; className?: string; pop?: boolean }) {
  const { resolvedPin } = usePrefs();
  const parts = PINS[shape ?? resolvedPin];
  /*
   * Sekme doğrudan MotionValue'larla oynatılır, `initial` ile değil: AnimatePresence initial={false} altında
   * (ilk yüklemedeki kartlar) yeniden takılan bir öğenin giriş animasyonu Motion tarafından engellenir.
   */
  const scale = useMotionValue(1);
  const y = useMotionValue(0);
  const anims = useRef<{ stop: () => void }[]>([]);
  useLayoutEffect(() => {
    if (!pop) return; // pop kapanınca yay yarıda kesilmez, kendi kendine 1'e oturur
    // jump: değer hızsız başlar (set bir sıçrama hızı bırakır, yay 1.2'nin üstüne taşardı)
    scale.jump(PIN_POP);
    y.jump(LIFT.pinRise);
    anims.current = [animate(scale, 1, PIN_SPRING), animate(y, 0, PIN_SPRING)];
  }, [pop, scale, y]);
  useEffect(() => () => anims.current.forEach((a) => a.stop()), []);
  return (
    <motion.svg className={className ?? "pin"} viewBox="0 0 22 30" width="22" height="30" aria-hidden focusable="false" style={{ scale, y }}>
      {parts.map((p, i) => {
        const common = { fill: FILL[p.fill], stroke: p.stroke && FILL[p.stroke], strokeWidth: p.strokeWidth, opacity: p.opacity };
        if (p.el === "path") return <path key={i} d={p.d} {...common} />;
        if (p.el === "circle") return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} {...common} />;
        return <rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} {...common} />;
      })}
    </motion.svg>
  );
}
