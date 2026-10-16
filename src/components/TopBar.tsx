import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { useMeta, useRefresh } from "@/hooks/useTasks";
import { relativeTime } from "@/lib/dates";
import { plural } from "@/lib/format";
import { Logo } from "./Logo";
import { SETTINGS_ID } from "./SettingsDrawer";
import { IconSettings } from "./icons";
import "./TopBar.css";

interface Props {
  pinPulse: number;
  syncedAt: string | null;
  fetching: boolean;
  error: string | null;
  count: number;
  settingsOpen: boolean;
  onSettings: () => void;
  gearRef: RefObject<HTMLButtonElement | null>;
  /** Ortadaki yuva: filtre kapsülü ve odak notu */
  children?: ReactNode;
}

/** Üst çubuk: logo · (kapsül) · senkron durumu + dişli. Sekme ya da alt gezinme yoktur. */
export function TopBar({ pinPulse, syncedAt, fetching, error, count, settingsOpen, onSettings, gearRef, children }: Props) {
  return (
    <header className="topbar">
      <a href="#pano" className="topbar__brand" aria-label="Mantar Pano — panoya git">
        <Logo pulse={pinPulse} />
      </a>
      {children}
      <div className="topbar__end">
        <SyncStatus syncedAt={syncedAt} fetching={fetching} error={error} count={count} />
        <button
          ref={gearRef}
          type="button"
          className="topbar__gear"
          aria-label="Tema ve ayarlar"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          aria-controls={settingsOpen ? SETTINGS_ID : undefined}
          onClick={onSettings}
        >
          <IconSettings width={18} height={18} />
        </button>
      </div>
    </header>
  );
}

function SyncStatus({ syncedAt, fetching, error, count }: { syncedAt: string | null; fetching: boolean; error: string | null; count: number }) {
  const { data: meta } = useMeta();
  const refresh = useRefresh();
  const [, tick] = useState(0);

  // "x dk önce" metnini canlı tut
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const mode = meta?.mode;
  const busy = fetching || refresh.isPending;
  const where = mode === "demo" ? "Demo verisi" : mode === "local" ? "Bu cihazda" : syncedAt ? `Notion · ${relativeTime(syncedAt)}` : "Notion";
  const label = error ? "Bağlantı yok" : busy ? "Eşitleniyor…" : `${where} · ${plural(count, "kart")}`;
  const short = error || busy ? label : plural(count, "kart");
  const title =
    error ??
    (mode === "demo"
      ? "Notion token'ı tanımlı değil; yerel kopya kullanılıyor. Yenilemek için tıkla."
      : mode === "local"
        ? "Kartlar bu tarayıcıda saklanıyor (local-first). Ayarlar'dan JSON olarak dışa aktarabilirsin."
        : "Notion'dan şimdi çek");
  const tone = error ? "error" : busy ? "busy" : mode === "notion" ? "ok" : "local";

  return (
    <button type="button" className={`sync sync--${tone}`} onClick={() => refresh.mutate()} title={title} aria-label={`${label} — yenile`}>
      <i className="sync__dot" aria-hidden />
      <span className="sync__label">{label}</span>
      <span className="sync__short" aria-hidden>
        {short}
      </span>
    </button>
  );
}
