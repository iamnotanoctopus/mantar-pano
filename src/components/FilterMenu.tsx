import { useEffect, useRef, type RefObject } from "react";
import type { Schema } from "@shared/types";
import { areaColor, colorVar, plural } from "@/lib/format";
import type { Filters } from "@/state/prefs";
import { useDismiss } from "@/hooks/useDismiss";
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

/** Süz ▾: Alan (çoklu), Öncelik (çoklu), Bitmişleri göster. Masaüstünde kapsülün altında açılır, telefonda alt sayfa. */
export function FilterMenu({ open, onClose, anchorRef, schema, filters, onFilters, showDone, onShowDone, shown }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, onClose, [anchorRef]);

  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>("button")?.focus();
  }, [open]);

  if (!open) return null;
  const any = filters.areas.length > 0 || filters.priorities.length > 0 || showDone;

  return (
    <>
      <div className="sheet-scrim" aria-hidden onClick={onClose} />
      <div ref={ref} className="filter" role="dialog" aria-label="Süz">
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

        <button type="button" className="filter__apply" onClick={onClose}>
          Uygula · {plural(shown, "kart")}
        </button>
      </div>
    </>
  );
}
