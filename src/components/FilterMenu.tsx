import { useEffect, useRef, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { INSTANT } from "@/lib/physics";
import type { Schema } from "@shared/types";
import { areaColor, colorVar, plural } from "@/lib/format";
import type { Filters } from "@/state/prefs";
import { useDismiss } from "@/hooks/useDismiss";
import { PHONE, useMediaQuery } from "@/hooks/useMediaQuery";
import { Switch } from "./Switch";
import "./FilterMenu.css";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  schema: Schema;
  filters: Filters;
  onFilters: (f: Filters) => void;
  showDone: boolean;
  onShowDone: (b: boolean) => void;
  /** Süzgeçten geçen ve panoda görünen kart sayısı */
  shown: number;
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const FILTER_MENU_ID = "mp-suz";

/**
 * Süz ▾: Alan (çoklu), Öncelik (çoklu), Bitmişleri göster. Masaüstünde kapsülün altında açılır, telefonda alt sayfa;
 * açılış ve kapanış varsayılan yayla (MotionConfig). Açılınca ilk etkin denetime, Esc ya da Uygula ile kapanınca
 * Süz düğmesine odaklanır.
 */
export function FilterMenu({ open, onClose, anchorRef, schema, filters, onFilters, showDone, onShowDone, shown }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const phone = useMediaQuery(PHONE);
  // Hareketi azalt: açılış/kapanış anında (MotionConfig yalnızca transform'ları kapatır, saydamlık yayı kalırdı)
  const instant = useReducedMotion() ? INSTANT : undefined;
  useDismiss(open, ref, onClose, [anchorRef], () => anchorRef.current);

  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }, [open]);

  const any = filters.areas.length > 0 || filters.priorities.length > 0 || showDone;
  const off = phone ? { y: "100%" } : { opacity: 0, y: -6, scale: 0.96 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="scrim" className="sheet-scrim" aria-hidden onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={instant} />
      )}
      {open && (
      <motion.div
        key="menu"
        ref={ref}
        id={FILTER_MENU_ID}
        className="filter"
        role="dialog"
        aria-label="Süz"
        initial={off}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={off}
        transition={instant}
      >
        <i className="sheet-grip" aria-hidden />
        <div className="filter__head">
          <h2 className="filter__title">Süz</h2>
          <button
            type="button"
            className="filter__clear"
            disabled={!any}
            onClick={() => {
              onFilters({ areas: [], priorities: [] });
              onShowDone(false);
            }}
          >
            Temizle
          </button>
        </div>

        <fieldset className="filter__group">
          <legend className="filter__legend">Alan</legend>
          <div className="filter__chips">
            {schema.areas.map((a) => (
              <button
                key={a.name}
                type="button"
                className="fchip"
                aria-pressed={filters.areas.includes(a.name)}
                onClick={() => onFilters({ ...filters, areas: toggle(filters.areas, a.name) })}
              >
                <i className="fchip__dot" style={{ background: areaColor(a.name, a.color) }} aria-hidden />
                {a.name}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filter__group">
          <legend className="filter__legend">Öncelik</legend>
          <div className="filter__chips">
            {schema.priorities.map((p) => (
              <button
                key={p.name}
                type="button"
                className="fchip"
                aria-pressed={filters.priorities.includes(p.name)}
                onClick={() => onFilters({ ...filters, priorities: toggle(filters.priorities, p.name) })}
              >
                <i className="fchip__dot" style={{ background: colorVar(p.color) }} aria-hidden />
                {p.name}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="filter__row">
          <span>Bitmişleri göster</span>
          <Switch checked={showDone} onChange={onShowDone} label="Bitmişleri göster" />
        </div>

        <button
          type="button"
          className="filter__apply"
          onClick={() => {
            onClose();
            anchorRef.current?.focus();
          }}
        >
          Uygula · {plural(shown, "kart")}
        </button>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
