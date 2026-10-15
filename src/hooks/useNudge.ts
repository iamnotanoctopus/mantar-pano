import { useCallback, useRef } from "react";
import { useSound } from "./useSound";
import "@/styles/nudge.css";

const DURATION = 650;

/**
 * MSN Messenger tarzı "dürtme": uygulama penceresi kısa süre titrer, buzz sesi çalar.
 * Animasyon `.app` sarmalayıcısında left/top üzerinden yapılır (transform kullanılmaz;
 * böylece sabit konumlu alt menü ve çekmece bağlam kutusunu kaybetmez).
 * `prefers-reduced-motion` açıksa titreme yerine kısa bir çerçeve parlaması gösterilir.
 */
export function useNudge() {
  const play = useSound();
  const timer = useRef<number | null>(null);

  return useCallback(() => {
    const el = document.querySelector<HTMLElement>(".app");
    const nav = document.querySelector<HTMLElement>(".bnav");
    play("nudge");
    if (!el) return;
    if (timer.current) window.clearTimeout(timer.current);
    el.classList.remove("is-nudging");
    nav?.classList.remove("is-nudging");
    // yeniden tetiklemede animasyonu sıfırla
    void el.offsetWidth;
    el.classList.add("is-nudging");
    nav?.classList.add("is-nudging");
    timer.current = window.setTimeout(() => {
      el.classList.remove("is-nudging");
      nav?.classList.remove("is-nudging");
      timer.current = null;
    }, DURATION);
  }, [play]);
}
