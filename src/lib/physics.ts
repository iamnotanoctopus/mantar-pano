/**
 * Hareket fiziği — değerler design/tokens.json "fizik" ailesinden okunur (tek kaynak).
 * Hiçbir geçiş linear ya da 150ms ease-in-out değildir: her hareket bir yaydır.
 */
import tokens from "../../design/tokens.json";

const f = Object.fromEntries(tokens.fizik.tokens.map((t) => [t.name, parseFloat(t.value)])) as Record<string, number>;

/** Varsayılan yay: kart yerleşimi, kapsül hapı, çekmece (380 / 30 / 0.8) */
export const SPRING = { type: "spring", stiffness: f["yay-sertlik"], damping: f["yay-sonum"], mass: f["yay-kutle"] } as const;
/** Raptiye saplanması: daha sert, düşük sönüm → görünür sekme (520 / 18) */
export const PIN_SPRING = { type: "spring", stiffness: f["yay-raptiye-sertlik"], damping: f["yay-raptiye-sonum"], mass: 1 } as const;

/** Kart tutulduğunda: ölçek, eğim (derece; işaret sürükleme yönünden) ve raptiyenin yükselmesi (px) */
export const LIFT = { scale: f["kart-tut-olcek"], rotate: f["kart-tut-aci"], pinRise: f["kart-tut-raptiye-yukselme"] };
/** Bırakınca raptiye bu ölçekten 1'e sekerek saplanır */
export const PIN_POP = f["raptiye-saplanma-olcek"];

/**
 * Pano kaydırma ataleti (Motion `dragTransition`): power 0.8, timeConstant ~350ms;
 * sınırda yay ile geri döner. (pano-atalet-surtunme 0.92/kare ≈ 200ms zaman sabitine karşılık gelir;
 * talimattaki ~350ms daha uzun bir süzülme verir ve o kullanıldı.)
 */
export const INERTIA = { power: 0.8, timeConstant: 350, bounceStiffness: SPRING.stiffness, bounceDamping: SPRING.damping } as const;
/** Kenar direnci: sınırın ötesine sürüklerken hareketin ne kadarı geçer */
export const EDGE_ELASTIC = 0.16;

/** Hareket azaltma: yaylar anında çözülür */
export const INSTANT = { duration: 0 } as const;

/**
 * Bir yayı (x: 0 → 1) sayısal olarak çözüp CSS `linear()` eğrisine çevirir.
 * dnd-kit'in bırakma animasyonu (WAAPI) bu sayede aynı yayla oynar.
 */
export function springEasing(stiffness = SPRING.stiffness, damping = SPRING.damping, mass = SPRING.mass): { easing: string; duration: number } {
  const dt = 1 / 240;
  let x = 0;
  let v = 0;
  let t = 0;
  const samples: number[] = [0];
  let settled = 0;
  while (t < 3) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    t += dt;
    samples.push(x);
    if (Math.abs(1 - x) < 0.0015 && Math.abs(v) < 0.01) {
      if (++settled > 12) break;
    } else settled = 0;
  }
  const n = 48;
  const pts = Array.from({ length: n + 1 }, (_, i) => samples[Math.round((i / n) * (samples.length - 1))]);
  pts[n] = 1;
  return { easing: `linear(${pts.map((p) => Number(p.toFixed(4))).join(", ")})`, duration: Math.round(t * 1000) };
}

/** Tarayıcı CSS linear() eğrisini destekliyor mu? (desteklemiyorsa yaya yakın bir cubic-bezier) */
export const supportsLinearEasing = (): boolean => typeof CSS !== "undefined" && CSS.supports?.("transition-timing-function", "linear(0, 1)") === true;
export const SPRING_FALLBACK_EASING = "cubic-bezier(0.34, 1.3, 0.64, 1)";
