import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSkin, type SkinId } from "@/lib/skins";
import type { ViewId } from "@/lib/views";

export type Theme = "system" | "light" | "dark";

interface Prefs {
  theme: Theme;
  skin: SkinId;
  view: ViewId;
  showNotes: boolean;
  sound: boolean;
  nudgeOnOverdue: boolean;
}

interface PrefsCtx extends Prefs {
  setTheme: (t: Theme) => void;
  setSkin: (s: SkinId) => void;
  setView: (v: ViewId) => void;
  setShowNotes: (b: boolean) => void;
  setSound: (b: boolean) => void;
  setNudgeOnOverdue: (b: boolean) => void;
  resolvedTheme: "light" | "dark";
}

const KEY = "mp.prefs";
const DEFAULTS: Prefs = { theme: "system", skin: "mantar", view: "board", showNotes: true, sound: true, nudgeOnOverdue: true };
const Ctx = createContext<PrefsCtx | null>(null);

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
      if (!isSkin(p.skin)) p.skin = "mantar";
      return p;
    }
  } catch {
    /* yok say */
  }
  // claude.ai içinde açıldıysa görüntüleyenin tema seçimi kök öğede hazır gelir; ilk tercih olarak devral.
  const host = document.documentElement.dataset.theme;
  return { ...DEFAULTS, theme: host === "dark" || host === "light" ? host : "system" };
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
      // index.html'deki erken tema betiği için
      if (prefs.theme === "system") localStorage.removeItem("mp.theme");
      else localStorage.setItem("mp.theme", prefs.theme);
      localStorage.setItem("mp.skin", prefs.skin);
    } catch {
      /* yok say */
    }
  }, [prefs]);

  const resolvedTheme: "light" | "dark" = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = prefs.theme;
    if (prefs.skin === "mantar") delete root.dataset.skin;
    else root.dataset.skin = prefs.skin;
    const meta = document.querySelector('meta[name="theme-color"]:not([media])') ?? document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", getComputedStyle(root).getPropertyValue("--bg").trim() || (resolvedTheme === "dark" ? "#1c1815" : "#f3ece1"));
    if (!meta.parentNode) document.head.appendChild(meta);
  }, [prefs.theme, prefs.skin, resolvedTheme]);

  const set = <K extends keyof Prefs>(k: K) => (v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const setTheme = useCallback(set("theme"), []);
  const setSkin = useCallback(set("skin"), []);
  const setView = useCallback(set("view"), []);
  const setShowNotes = useCallback(set("showNotes"), []);
  const setSound = useCallback(set("sound"), []);
  const setNudgeOnOverdue = useCallback(set("nudgeOnOverdue"), []);

  const value = useMemo<PrefsCtx>(
    () => ({ ...prefs, resolvedTheme, setTheme, setSkin, setView, setShowNotes, setSound, setNudgeOnOverdue }),
    [prefs, resolvedTheme, setTheme, setSkin, setView, setShowNotes, setSound, setNudgeOnOverdue],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error("PrefsProvider eksik");
  return v;
}
