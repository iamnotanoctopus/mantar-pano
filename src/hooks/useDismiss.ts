import { useEffect, type RefObject } from "react";

/**
 * Açık bir menü/popover'ı dışarı tıklayınca ya da Esc'e basınca kapatır.
 * `ignore` içindeki öğelere (ör. menüyü açan düğme) tıklamak kapatmaz.
 */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void, ignore: RefObject<HTMLElement | null>[] = []) {
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
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // ignore dizisi her çağrıda yeni olabilir; içindeki ref'ler kararlıdır
  }, [open, onClose, ref]);
}
