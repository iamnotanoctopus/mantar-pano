import { useEffect, useRef, useState } from "react";
import { LOGO } from "@/lib/brand";
import "./Logo.css";

/**
 * Amanita raptiye logosu + "Mantar Pano" yazı markası.
 * `pulse` her arttığında (kart eklendi / iğnelendi) logo bir kez seker: data-pinned → CSS yay eğrisi.
 */
export function Logo({ pulse = 0, size = 30, wordmark = true }: { pulse?: number; size?: number; wordmark?: boolean }) {
  const [pinned, setPinned] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPinned(false);
    // yeniden tetiklemede animasyonu baştan başlat
    const raf = requestAnimationFrame(() => setPinned(true));
    const t = window.setTimeout(() => setPinned(false), 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [pulse]);

  return (
    <span className="logo" data-pinned={pinned || undefined}>
      <LogoMark size={size} />
      {wordmark && <span className="logo__word">Mantar Pano</span>}
    </span>
  );
}

export function LogoMark({ size = 30, title }: { size?: number; title?: string }) {
  return (
    <svg
      className="logo__mark"
      viewBox={LOGO.viewBox}
      width={size}
      height={(size * 80) / 64}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={LOGO.cap} fill="var(--raptiye-sapka)" />
      <path d={LOGO.gill} fill="var(--kart-kenar)" />
      {LOGO.spots.map(([cx, cy, rx, ry]) => (
        <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--raptiye-benek)" />
      ))}
      <path d={LOGO.stem} fill="var(--raptiye-benek)" />
      <path d={LOGO.needle} fill="var(--raptiye-igne)" />
      <rect {...LOGO.collar} fill="var(--raptiye-igne)" />
    </svg>
  );
}
