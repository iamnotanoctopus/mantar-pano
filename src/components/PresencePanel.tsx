import type { HTMLMotionProps } from "motion/react";
import { motion, useIsPresent } from "motion/react";

/**
 * AnimatePresence'ın doğrudan çocuğu olan açılır panel (Süz, takvim). Kapanırken sönmeye devam eder ama tıklama
 * almaz: kapattıktan hemen sonraki tıklama sönmekte olan paneldeki bir çipi ya da günü seçiyordu.
 */
export function PresencePanel({ style, ...props }: HTMLMotionProps<"div">) {
  const present = useIsPresent();
  return <motion.div {...props} style={{ ...style, pointerEvents: present ? undefined : "none" }} />;
}
