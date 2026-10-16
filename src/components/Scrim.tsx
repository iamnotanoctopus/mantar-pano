import type { Transition } from "motion/react";
import { motion, useIsPresent } from "motion/react";

/**
 * Alt sayfa / çekmece perdesi (AnimatePresence'ın doğrudan çocuğu olmalı). Kapanırken sönmeye devam eder ama artık
 * dokunuş yakalamaz: yarı saydamken bile tıklamaları yutup hemen ardından gelen dokunuşu boşa çıkarıyordu.
 */
export function Scrim({ className, onClick, transition }: { className: string; onClick: () => void; transition?: Transition }) {
  const present = useIsPresent();
  return (
    <motion.div
      className={className}
      aria-hidden
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition}
      style={{ pointerEvents: present ? undefined : "none" }}
    />
  );
}
