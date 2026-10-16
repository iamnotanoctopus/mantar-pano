import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveTheme, themeDef, type PinShape, type TextureId, type ThemeId, type ThemePref } from "@/lib/themes";
import { migratePrefs, type Filters, type Focus, type PinPref, type Prefs, type TexturePref } from "./prefsModel";

export type { Filters, Focus, PinPref, TexturePref } from "./prefsModel";

interface PrefsCtx extends Prefs {
  setTheme: (t: ThemePref) => void;
  setTexture: (t: TexturePref) => void;
  setPinStyle: (p: PinPref) => void;
  setShowNotes: (b: boolean) => void;
  setSound: (b: boolean) => void;
  setNudgeOnOverdue: (b: boolean) => void;
  setFocus: (f: Focus) => void;
  setFilters: (f: Filters) => void;
  setShowDone: (b: boolean) => void;
  /** "system" çözülmüş hâli: kökteki data-theme */
  resolvedTheme: ThemeId;
  /** Temanın varsayılanı ya da kullanıcının seçtiği doku/raptiye */
  resolvedTexture: TextureId;
  resolvedPin: PinShape;
}

const KEY = "mp.prefs";
const Ctx = createContext<PrefsCtx | null>(null);

function load(): Prefs {
  // claude.ai içinde açıldıysa görüntüleyenin açık/koyu seçimi kök öğede hazır gelir; ilk tercihte devralınır.
  // index.html'deki erken betik data-theme'i hemen kendi temasıyla değiştirdiği için asıl değeri data-host-theme'de saklar.
  const root = document.documentElement;
  const host = root.dataset.hostTheme ?? root.dataset.theme;
  try {
    const raw = localStorage.getItem(KEY);
    return migratePrefs(raw ? JSON.parse(raw) : null, host);
  } catch {
    return migratePrefs(null, host);
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
      // index.html'deki erken tema betiği için (ilk boyamada titreme olmasın)
      localStorage.setItem("mp.theme", prefs.theme);
      localStorage.removeItem("mp.skin");
    } catch {
      /* yok say */
    }
  }, [prefs]);

  const resolvedTheme = resolveTheme(prefs.theme, systemDark);
  const def = themeDef(resolvedTheme);
  const resolvedTexture: TextureId = prefs.texture === "auto" ? def.texture : prefs.texture;
  const resolvedPin: PinShape = prefs.pinStyle === "auto" ? def.pin : prefs.pinStyle;

  /* Kök öznitelikleri: tema, pano dokusu ve raptiye stili CSS'e buradan iner */
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.texture = resolvedTexture;
    root.dataset.pin = resolvedPin;
    const zemin = getComputedStyle(root).getPropertyValue("--zemin").trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", zemin || "#ebe4cf"));
  }, [resolvedTheme, resolvedTexture, resolvedPin]);

  const set = <K extends keyof Prefs>(k: K) => (v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const setTheme = useCallback(set("theme"), []);
  const setTexture = useCallback(set("texture"), []);
  const setPinStyle = useCallback(set("pinStyle"), []);
  const setShowNotes = useCallback(set("showNotes"), []);
  const setSound = useCallback(set("sound"), []);
  const setNudgeOnOverdue = useCallback(set("nudgeOnOverdue"), []);
  const setFocus = useCallback(set("focus"), []);
  const setFilters = useCallback(set("filters"), []);
  const setShowDone = useCallback(set("showDone"), []);

  const value = useMemo<PrefsCtx>(
    () => ({
      ...prefs,
      resolvedTheme,
      resolvedTexture,
      resolvedPin,
      setTheme,
      setTexture,
      setPinStyle,
      setShowNotes,
      setSound,
      setNudgeOnOverdue,
      setFocus,
      setFilters,
      setShowDone,
    }),
    [prefs, resolvedTheme, resolvedTexture, resolvedPin, setTheme, setTexture, setPinStyle, setShowNotes, setSound, setNudgeOnOverdue, setFocus, setFilters, setShowDone],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error("PrefsProvider eksik");
  return v;
}
