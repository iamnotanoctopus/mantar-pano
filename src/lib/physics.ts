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
