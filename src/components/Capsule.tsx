import { useEffect, useRef, type RefObject } from "react";
import { motion } from "motion/react";
import type { Focus } from "@/state/prefs";
import { addDays, weekRangeLabel } from "@/lib/dates";
import { DATE_POPOVER_ID } from "./DatePopover";
import { FILTER_MENU_ID } from "./FilterMenu";
import { IconBoard, IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight, IconFilter, IconPlus, IconSearch, IconSunrise, IconX } from "./icons";
import "./Capsule.css";

export const FOCUS_DEFS: { id: Focus; label: string; key: string; Icon: typeof IconBoard }[] = [
  { id: "areas", label: "Alanlar", key: "1", Icon: IconBoard },
  { id: "today", label: "Bugün", key: "2", Icon: IconSunrise },
  { id: "week", label: "Hafta", key: "3", Icon: IconCalendar },
];

interface Props {
  focus: Focus;
  onFocus: (f: Focus) => void;
  query: string;
  onQuery: (q: string) => void;
  searchOpen: boolean;
  onSearchOpen: (open: boolean) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  filterCount: number;
  filterOpen: boolean;
  onFilterToggle: () => void;
  filterBtnRef: RefObject<HTMLButtonElement | null>;
  weekStart: string;
  onWeek: (weekStart: string) => void;
  dateOpen: boolean;
  onDateToggle: () => void;
  dateBtnRef: RefObject<HTMLButtonElement | null>;
  onNew: () => void;
}

/**
 * Filtre kapsülü: [Alanlar · Bugün · Hafta] + Süz ▾ + Ara + Yeni kart.
 * Masaüstünde panonun üstünde ortada, telefonda altta (başparmak hizası); dar ekranda etiketler ikona iner.
 */
export function Capsule(p: Props) {
  const searchWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (p.searchOpen) p.searchRef.current?.focus();
  }, [p.searchOpen, p.searchRef]);

  return (
    <div className="capsule" role="toolbar" aria-label="Pano düzeni ve süzgeç">
      <div className="capsule__segs" role="group" aria-label="Düzen">
        {FOCUS_DEFS.map(({ id, label, key, Icon }) => (
          <button
            key={id}
            type="button"
            className="capsule__seg"
            aria-pressed={p.focus === id}
            aria-label={label}
            title={`${label} (${key})`}
            onClick={() => p.onFocus(id)}
          >
            {/* Seçili hap: layoutId ile bölümler arasında yaylanarak kayar */}
            {p.focus === id && <motion.span layoutId="capsule-pill" className="capsule__pill" aria-hidden />}
            <Icon className="capsule__seg-icon" width={18} height={18} />
            <span className="capsule__seg-label">{label}</span>
          </button>
        ))}
      </div>

      {p.focus === "week" && <WeekNav className="capsule__week" {...p} />}

      <span className="capsule__sep" aria-hidden />

      <button
        ref={p.filterBtnRef}
        type="button"
        className="capsule__btn capsule__btn--filter"
        aria-haspopup="dialog"
        aria-expanded={p.filterOpen}
        aria-controls={p.filterOpen ? FILTER_MENU_ID : undefined}
        aria-label={p.filterCount ? `Süz (${p.filterCount} süzgeç açık)` : "Süz"}
        onClick={p.onFilterToggle}
      >
        <IconFilter width={17} height={17} />
        <span className="capsule__label">Süz</span>
        {p.filterCount > 0 && <span className="capsule__badge">{p.filterCount}</span>}
        <IconChevronDown className="capsule__caret" width={13} height={13} strokeWidth={2.2} />
      </button>

      <div ref={searchWrap} className={`capsule__search ${p.searchOpen || p.query ? "is-open" : ""}`}>
        <button
          type="button"
          className="capsule__btn capsule__btn--icon"
          aria-label="Ara (/)"
          aria-expanded={p.searchOpen || Boolean(p.query)}
          onClick={() => (p.searchOpen ? p.searchRef.current?.focus() : p.onSearchOpen(true))}
        >
          <IconSearch width={17} height={17} />
        </button>
        <input
          ref={p.searchRef}
          className="capsule__input"
          value={p.query}
          placeholder="Kartlarda ara…"
          aria-label="Kartlarda ara"
          tabIndex={p.searchOpen || p.query ? 0 : -1}
          onChange={(e) => p.onQuery(e.target.value)}
          onBlur={() => !p.query && p.onSearchOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              p.onQuery("");
              p.onSearchOpen(false);
              e.currentTarget.blur();
            }
          }}
        />
        {p.query && (
          <button
            type="button"
            className="capsule__clear"
            aria-label="Aramayı temizle"
            onClick={() => {
              p.onQuery("");
              p.searchRef.current?.focus();
            }}
          >
            <IconX width={13} height={13} />
          </button>
        )}
      </div>

      <button type="button" className="capsule__btn capsule__btn--new" onClick={p.onNew} aria-label="Yeni kart (N)">
        <IconPlus width={17} height={17} strokeWidth={2.2} />
        <span className="capsule__label">Yeni kart</span>
      </button>
    </div>
  );
}

/** Hafta odağında: ‹ önceki hafta · tarih aralığı (ay ızgarasını açar, T) · sonraki hafta › */
export function WeekNav({
  className,
  weekStart,
  onWeek,
  dateOpen,
  onDateToggle,
  dateBtnRef,
}: Pick<Props, "weekStart" | "onWeek" | "dateOpen" | "onDateToggle" | "dateBtnRef"> & { className?: string }) {
  return (
    <div className={`weeknav ${className ?? ""}`} role="group" aria-label="Hafta">
      <button type="button" className="weeknav__step" aria-label="Önceki hafta" onClick={() => onWeek(addDays(weekStart, -7))}>
        <IconChevronLeft width={15} height={15} />
      </button>
      <button
        ref={dateBtnRef}
        type="button"
        className="weeknav__date"
        aria-haspopup="dialog"
        aria-expanded={dateOpen}
        aria-controls={dateOpen ? DATE_POPOVER_ID : undefined}
        title="Takvimden hafta seç (T)"
        onClick={onDateToggle}
      >
        <IconCalendar width={15} height={15} />
        {weekRangeLabel(weekStart)}
      </button>
      <button type="button" className="weeknav__step" aria-label="Sonraki hafta" onClick={() => onWeek(addDays(weekStart, 7))}>
        <IconChevronRight width={15} height={15} />
      </button>
    </div>
  );
}
