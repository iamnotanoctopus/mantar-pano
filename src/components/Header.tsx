import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { localApi } from "@/data";
import { useMeta, useRefresh } from "@/hooks/useTasks";
import { relativeTime } from "@/lib/dates";
import { THEMES } from "@/lib/themes";
import { VIEWS, type ViewId } from "@/lib/views";
import { usePrefs } from "@/state/prefs";
import { useToast } from "./Toast";
import { Logo } from "./Logo";
import {
  IconDevice,
  IconNudge,
  IconBoard,
  IconCalendar,
  IconCloud,
  IconExternal,
  IconList,
  IconMonitor,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSunrise,
  IconUpcoming,
  IconX,
} from "./icons";
import "./Header.css";

export const VIEW_ICONS: Record<ViewId, (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  board: IconBoard,
  today: IconSunrise,
  upcoming: IconUpcoming,
  calendar: IconCalendar,
  all: IconList,
};

interface Props {
  query: string;
  onQuery: (q: string) => void;
  onNew: () => void;
  onNudge: () => void;
  syncedAt: string | null;
  fetching: boolean;
  error: string | null;
  searchRef: React.RefObject<HTMLInputElement | null>;
  view: ViewId;
  setView: (v: ViewId) => void;
  /** Kart eklenince / iğnelenince artar: logo seker */
  pinPulse: number;
}

export function Header({ query, onQuery, onNew, onNudge, syncedAt, fetching, error, searchRef, view, setView, pinPulse }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (query) setSearchOpen(true);
  }, [query]);

  return (
    <header className="hdr">
      <h1 className="hdr__brand">
        <Logo pulse={pinPulse} />
      </h1>

      <nav className="hdr__tabs hide-mobile" aria-label="Görünümler">
        {VIEWS.map((v) => {
          const Icon = VIEW_ICONS[v.id];
          return (
            <button
              key={v.id}
              className={`hdr__tab ${view === v.id ? "is-active" : ""}`}
              onClick={() => setView(v.id)}
              title={v.hint}
              aria-current={view === v.id ? "page" : undefined}
            >
              <Icon width={16} height={16} />
              {v.label}
            </button>
          );
        })}
      </nav>

      <div className="hdr__actions">
        <div className={`hdr__search ${searchOpen || query ? "is-open" : ""}`}>
          <button
            className="btn btn--ghost btn--icon"
            aria-label="Ara"
            onClick={() => {
              setSearchOpen(true);
              window.setTimeout(() => searchRef.current?.focus(), 0);
            }}
          >
            <IconSearch />
          </button>
          <input
            ref={searchRef}
            className="hdr__search-input"
            value={query}
            placeholder="Kartlarda ara…  /"
            onChange={(e) => onQuery(e.target.value)}
            onBlur={() => !query && setSearchOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onQuery("");
                setSearchOpen(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            aria-label="Kartlarda ara"
          />
          {query && (
            <button
              className="hdr__search-clear"
              aria-label="Aramayı temizle"
              onClick={() => {
                onQuery("");
                searchRef.current?.focus();
              }}
            >
              <IconX width={14} height={14} />
            </button>
          )}
        </div>

        <SyncStatus syncedAt={syncedAt} fetching={fetching} error={error} />

        <button className="btn btn--ghost btn--icon hide-mobile" onClick={onNudge} aria-label="Panoyu dürt" title="Dürt (D) — MSN usulü">
          <IconNudge />
        </button>

        <button className="btn btn--primary hide-mobile" onClick={onNew}>
          <IconPlus /> Yeni kart
        </button>

        <SettingsMenu onNudge={onNudge} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------ Senkron */

function SyncStatus({ syncedAt, fetching, error }: { syncedAt: string | null; fetching: boolean; error: string | null }) {
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
  const label = error
    ? "Bağlantı yok"
    : busy
      ? "Eşitleniyor…"
      : mode === "demo"
        ? "Demo verisi"
        : mode === "local"
          ? "Bu cihazda"
          : syncedAt
            ? `Notion · ${relativeTime(syncedAt)}`
            : "Notion";
  const title =
    error ??
    (mode === "demo"
      ? "Notion token'ı tanımlı değil; yerel kopya kullanılıyor. Yenilemek için tıkla."
      : mode === "local"
        ? "Kartlar bu tarayıcıda saklanıyor (local-first). Ayarlar'dan JSON olarak dışa aktarabilirsin."
        : "Notion'dan şimdi çek");

  return (
    <button
      className={`sync ${error ? "sync--error" : mode === "demo" ? "sync--demo" : mode === "local" ? "sync--local" : "sync--ok"} ${busy ? "is-busy" : ""}`}
      onClick={() => refresh.mutate()}
      title={title}
      aria-label="Eşitleme durumu — yenile"
    >
      {error ? (
        <IconX width={14} height={14} />
      ) : busy ? (
        <IconRefresh width={14} height={14} className="spin" />
      ) : mode === "local" ? (
        <IconDevice width={14} height={14} />
      ) : (
        <IconCloud width={14} height={14} />
      )}
      <span className="hide-mobile">{label}</span>
    </button>
  );
}

/* --------------------------------------------------------------- Ayarlar */

function SettingsMenu({ onNudge }: { onNudge: () => void }) {
  const { theme, setTheme, showNotes, setShowNotes, sound, setSound, nudgeOnOverdue, setNudgeOnOverdue } = usePrefs();
  const { data: meta } = useMeta();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const exportJson = async () => {
    const filename = `mantar-pano-${new Date().toISOString().slice(0, 10)}.json`;
    const json = localApi.exportJson();
    try {
      // claude.ai içinde: sayfa doğrudan indiremez, "downloads" yeteneği görüntüleyene sorar.
      const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
      if (claude?.use) {
        const dl = (await claude.use("downloads").catch(() => null)) as { save: (r: { filename: string; data: string }) => Promise<unknown> } | null;
        if (dl) {
          await dl.save({ filename, data: json });
          toast.success("Kartlar JSON olarak kaydedildi.");
        } else toast.error("Bu görünümde dosya kaydetme kapalı.");
        return;
      }
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("Kartlar JSON olarak indirildi.");
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "declined") return;
      toast.error(`Dışa aktarılamadı: ${(e as Error).message ?? code ?? "bilinmeyen hata"}`);
    }
  };

  const importJson = async (file: File) => {
    try {
      const n = localApi.importJson(await file.text());
      await qc.invalidateQueries();
      toast.success(`${n} kart içe aktarıldı.`);
    } catch (e) {
      toast.error(`İçe aktarılamadı: ${(e as Error).message}`);
    }
  };

  const resetDemo = async () => {
    localApi.resetDemo();
    await qc.invalidateQueries();
    toast.info("Örnek kartlar geri yüklendi.");
  };

  const connLabel = meta?.mode === "notion" ? "Notion · canlı senkron" : meta?.mode === "local" ? "Bu cihazda (local-first)" : "Demo modu";
  const connHint =
    meta?.mode === "notion"
      ? `${meta.dataSourceTitle ?? "Görevlerim"} veri kaynağı`
      : meta?.mode === "local"
        ? "Kartlar bu tarayıcıda saklanır; hesap ya da sunucu gerekmez. JSON ile yedekle ve taşı."
        : "NOTION_TOKEN tanımlanınca Notion'a bağlanır. Şimdilik yerel kopya düzenleniyor.";

  return (
    <div className="settings" ref={ref}>
      <button className="btn btn--ghost btn--icon" aria-label="Ayarlar" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconSettings />
      </button>
      {open && (
        <div className="settings__pop" role="menu">
          <div className="settings__section">
            <span className="field__label">Tema</span>
            <div className="skins" role="radiogroup" aria-label="Tema">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`skin ${theme === t.id ? "is-active" : ""}`}
                  aria-pressed={theme === t.id}
                  title={t.hint}
                  onClick={() => setTheme(t.id)}
                >
                  <span className="skin__swatch" aria-hidden>
                    <i style={{ background: t.swatch.board }} />
                    <i style={{ background: t.swatch.card }} />
                    <i style={{ background: t.swatch.accent }} />
                  </span>
                  <span className="skin__label">{t.short}</span>
                </button>
              ))}
            </div>
            <button className={`seg__btn ${theme === "system" ? "is-active" : ""}`} onClick={() => setTheme("system")}>
              <IconMonitor width={14} height={14} /> Sisteme uy (açıkta Amanita, koyuda Midnight)
            </button>
          </div>
          <div className="settings__section">
            <label className="settings__toggle">
              <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
              Ses efektleri
            </label>
            <label className="settings__toggle">
              <input type="checkbox" checked={nudgeOnOverdue} onChange={(e) => setNudgeOnOverdue(e.target.checked)} />
              Gecikmiş kart varsa açılışta dürt
            </label>
            <label className="settings__toggle">
              <input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} />
              Kartlarda not önizlemesini göster
            </label>
            <button
              className="btn btn--sm"
              onClick={() => {
                setOpen(false);
                onNudge();
              }}
            >
              <IconNudge /> Panoyu dürt
            </button>
          </div>
          <div className="settings__section settings__conn">
            <span className="field__label">Bağlantı</span>
            {meta ? (
              <>
                <p>
                  <strong>{connLabel}</strong>
                </p>
                <p className="muted">{connHint}</p>
                {meta.notionUrl && (
                  <a href={meta.notionUrl} target="_blank" rel="noreferrer" className="settings__link">
                    <IconExternal width={13} height={13} /> Notion'da aç
                  </a>
                )}
                {meta.mode === "local" && (
                  <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                    <button className="btn btn--sm" onClick={exportJson}>
                      Dışa aktar (JSON)
                    </button>
                    <button className="btn btn--sm" onClick={() => fileRef.current?.click()}>
                      İçe aktar
                    </button>
                    <button className="btn btn--sm btn--ghost" onClick={resetDemo}>
                      Örnekleri geri yükle
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/json,.json"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importJson(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="muted">Sunucuya ulaşılamıyor.</p>
            )}
          </div>
          <div className="settings__section settings__keys muted">
            <span>
              <kbd>N</kbd> yeni kart
            </span>
            <span>
              <kbd>/</kbd> ara
            </span>
            <span>
              <kbd>D</kbd> dürt
            </span>
            <span>
              <kbd>1</kbd>–<kbd>5</kbd> görünüm
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------ Mobil alt menü */

export function BottomNav({ onNew, view, setView }: { onNew: () => void; view: ViewId; setView: (v: ViewId) => void }) {
  return (
    <nav className="bnav" aria-label="Görünümler">
      {VIEWS.slice(0, 2).map((v) => (
        <NavBtn key={v.id} id={v.id} label={v.short} active={view === v.id} onClick={() => setView(v.id)} />
      ))}
      <button className="bnav__fab" onClick={onNew} aria-label="Yeni kart">
        <IconPlus width={22} height={22} strokeWidth={2.2} />
      </button>
      {VIEWS.slice(2, 4).map((v) => (
        <NavBtn key={v.id} id={v.id} label={v.short} active={view === v.id} onClick={() => setView(v.id)} />
      ))}
      <NavBtn id="all" label="Tümü" active={view === "all"} onClick={() => setView("all")} />
    </nav>
  );
}

function NavBtn({ id, label, active, onClick }: { id: ViewId; label: string; active: boolean; onClick: () => void }) {
  const Icon = VIEW_ICONS[id];
  return (
    <button className={`bnav__btn ${active ? "is-active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <Icon width={20} height={20} />
      <span>{label}</span>
    </button>
  );
}
