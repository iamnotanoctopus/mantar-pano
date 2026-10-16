import { useEffect, useRef, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { localApi } from "@/data";
import { useMeta } from "@/hooks/useTasks";
import { useDismiss, useFocusTrap } from "@/hooks/useDismiss";
import { PHONE, useMediaQuery } from "@/hooks/useMediaQuery";
import { INSTANT, SPRING } from "@/lib/physics";
import { THEMES, themeDef } from "@/lib/themes";
import type { PinPref, TexturePref } from "@/state/prefs";
import { usePrefs } from "@/state/prefs";
import { useToast } from "./Toast";
import { Switch } from "./Switch";
import { SegPicker } from "./SegPicker";
import { Pin } from "./Pin";
import { IconExternal, IconNudge, IconX } from "./icons";
import "./SettingsDrawer.css";

interface Props {
  onClose: () => void;
  onNudge: () => void;
  /** Kapanınca odağın döneceği düğme (dişli) */
  returnFocus: RefObject<HTMLElement | null>;
}

/**
 * Tema & ayarlar çekmecesi: masaüstünde sağdan 360px (x: 100% → 0), telefonda alt sayfa (y: 100% → 0);
 * yay 380/30/0.8. Arka plan 2px bulanık ve %20 karartılmış. AnimatePresence içinde açılıp kapanır.
 */
export const SETTINGS_ID = "mp-ayarlar";

export function SettingsDrawer({ onClose, onNudge, returnFocus }: Props) {
  const prefs = usePrefs();
  const { data: meta } = useMeta();
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const phone = useMediaQuery(PHONE);
  const reduce = useReducedMotion();
  useDismiss(true, ref, onClose, [returnFocus]);
  // aria-modal: Tab / Shift+Tab çekmecenin içinde döner (arka plan ayrıca inert)
  useFocusTrap(ref);

  useEffect(() => {
    closeRef.current?.focus();
    const back = returnFocus.current;
    return () => back?.focus();
  }, [returnFocus]);

  const def = themeDef(prefs.resolvedTheme);
  const TEXTURE_NAMES: Record<string, string> = { mantar: "Mantar", ahsap: "Ahşap", cam: "Cam", duz: "Düz" };
  const PIN_NAMES: Record<string, string> = { amanita: "Amanita", classic: "Klasik", glass: "Cam", midnight: "Pastel" };
  const textures: { id: TexturePref; label: string; hint?: string }[] = [
    { id: "auto", label: "Tema", hint: `Temanın dokusu (${TEXTURE_NAMES[def.texture]})` },
    { id: "mantar", label: "Mantar" },
    { id: "ahsap", label: "Ahşap" },
    { id: "cam", label: "Cam" },
    { id: "duz", label: "Düz" },
  ];
  const pins: { id: PinPref; label: string; hint?: string }[] = [
    { id: "auto", label: "Tema", hint: `Temanın raptiyesi (${PIN_NAMES[def.pin]})` },
    { id: "amanita", label: "Amanita" },
    { id: "classic", label: "Klasik" },
    { id: "glass", label: "Cam" },
    { id: "midnight", label: "Pastel" },
  ];

  const off = phone ? { y: "100%" } : { x: "100%" };
  const t = reduce ? INSTANT : SPRING;

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
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
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
    <>
      <motion.div className="drawer-scrim" aria-hidden onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t} />
      <motion.aside
        ref={ref}
        id={SETTINGS_ID}
        className="settings"
        role="dialog"
        aria-modal="true"
        aria-label="Tema ve ayarlar"
        initial={off}
        animate={{ x: 0, y: 0 }}
        exit={off}
        transition={t}
      >
        <i className="sheet-grip" aria-hidden />
        <div className="settings__head">
          <h2 className="settings__title">Tema &amp; ayarlar</h2>
          <button ref={closeRef} type="button" className="settings__close" aria-label="Kapat (Esc)" onClick={onClose}>
            <IconX width={14} height={14} />
          </button>
        </div>

        <div className="settings__scroll">
          <section className="settings__sec">
            <p className="settings__label">Tema</p>
            <div className="settings__themes" role="group" aria-label="Tema">
              {THEMES.map((t) => {
                const on = prefs.theme === "system" ? prefs.resolvedTheme === t.id : prefs.theme === t.id;
                return (
                  <button key={t.id} type="button" className="theme-card" aria-pressed={on} title={`${t.label} — ${t.hint}`} onClick={() => prefs.setTheme(t.id)}>
                    {/* Küçük önizleme o temanın kendi token'larıyla: pano, kâğıt, vurgu ve raptiye */}
                    <span className="theme-card__board" data-theme-scope={t.id} aria-hidden>
                      <i className="theme-card__paper" />
                      <Pin shape={t.pin} className="theme-card__pin" />
                      <i className="theme-card__accent" />
                    </span>
                    {t.short}
                  </button>
                );
              })}
            </div>
            <div className="settings__row">
              <span>
                Sisteme uy
                <small>Açık modda Amanita, koyu modda Midnight Wood</small>
              </span>
              <Switch checked={prefs.theme === "system"} onChange={(on) => prefs.setTheme(on ? "system" : prefs.resolvedTheme)} label="Sisteme uy" />
            </div>
            <div className="settings__row settings__row--stack">
              <span>
                Pano dokusu
                <small>Mantar · Ahşap · Cam · Düz</small>
              </span>
              <SegPicker label="Pano dokusu" value={prefs.texture} options={textures} onChange={prefs.setTexture} />
            </div>
            <div className="settings__row settings__row--stack">
              <span>
                Raptiye stili
                <small>Temadan bağımsız seçilebilir</small>
              </span>
              <SegPicker label="Raptiye stili" value={prefs.pinStyle} options={pins} onChange={prefs.setPinStyle} />
            </div>
          </section>

          <section className="settings__sec">
            <div className="settings__row">
              <span>
                Not önizlemesi
                <small>Alanlar düzeninde kartın altında</small>
              </span>
              <Switch checked={prefs.showNotes} onChange={prefs.setShowNotes} label="Not önizlemesi" />
            </div>
            <div className="settings__row">
              <span>
                Ses efektleri
                <small>Web Audio ile sentezlenir</small>
              </span>
              <Switch checked={prefs.sound} onChange={prefs.setSound} label="Ses efektleri" />
            </div>
            <div className="settings__row">
              <span>
                Gecikmiş kartta dürt
                <small>Açılışta bir kez, MSN tarzı (D)</small>
              </span>
              <Switch checked={prefs.nudgeOnOverdue} onChange={prefs.setNudgeOnOverdue} label="Gecikmiş kartta dürt" />
            </div>
            <button
              type="button"
              className="settings__btn"
              onClick={() => {
                onClose();
                onNudge();
              }}
            >
              <IconNudge width={16} height={16} /> Panoyu dürt
            </button>
          </section>

          <section className="settings__sec">
            <p className="settings__label">Veri</p>
            {meta ? (
              <>
                <p className="settings__conn">
                  <strong>{connLabel}</strong>
                  <small>{connHint}</small>
                </p>
                {meta.notionUrl && (
                  <a href={meta.notionUrl} target="_blank" rel="noreferrer" className="settings__link">
                    <IconExternal width={13} height={13} /> Notion'da aç
                  </a>
                )}
                {meta.mode === "local" && (
                  <div className="settings__actions">
                    <button type="button" className="settings__btn" onClick={exportJson}>
                      JSON dışa aktar
                    </button>
                    <button type="button" className="settings__btn" onClick={() => fileRef.current?.click()}>
                      İçe aktar
                    </button>
                    <button type="button" className="settings__btn settings__btn--ghost" onClick={resetDemo}>
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
              <p className="settings__conn">
                <small>Sunucuya ulaşılamıyor.</small>
              </p>
            )}
          </section>

          <p className="settings__keys">
            Kısayollar: <kbd>N</kbd> yeni kart · <kbd>/</kbd> ara · <kbd>D</kbd> dürt · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> düzen · <kbd>T</kbd> takvim · <kbd>Esc</kbd> kapat
          </p>
        </div>
      </motion.aside>
    </>
  );
}
