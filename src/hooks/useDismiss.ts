import { useEffect, type RefObject } from "react";

/**
 * Açık bir menü/popover'ı dışarı tıklayınca ya da Esc'e basınca kapatır.
 * `ignore` içindeki öğelere (ör. menüyü açan düğme) tıklamak kapatmaz.
 * Esc ile kapanınca odak `returnFocus`un verdiği öğeye (genellikle açan düğme) döner;
 * dışarı tıklanınca odak kullanıcının tıkladığı yerde kalır.
 */
export function useDismiss(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  ignore: RefObject<HTMLElement | null>[] = [],
  returnFocus?: () => HTMLElement | null | undefined,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ignore.some((r) => r.current?.contains(t))) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        returnFocus?.()?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // ignore dizisi ve returnFocus her çağrıda yeni olabilir; içindeki ref'ler kararlıdır
  }, [open, onClose, ref]);
}

/** Görünür olan ilk öğe (masaüstü ve telefonda farklı düğmeler aynı menüyü açabilir) */
export function firstVisible(refs: RefObject<HTMLElement | null>[]): HTMLElement | null {
  return refs.map((r) => r.current).find((el): el is HTMLElement => Boolean(el && el.getClientRects().length > 0)) ?? null;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal içinde Tab / Shift+Tab döner: odak arkadaki sayfaya kaçmaz */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const root = ref.current;
      if (e.key !== "Tab" || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (!root.contains(at)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && at === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && at === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ref, active]);
}
