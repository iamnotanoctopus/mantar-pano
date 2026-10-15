import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { IconAlert, IconCheck, IconX } from "./icons";
import "./Toast.css";

type Kind = "info" | "error" | "success";
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}
interface ToastApi {
  info: (text: string) => void;
  error: (text: string) => void;
  success: (text: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: Kind, text: string) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      info: (t) => push("info", t),
      error: (t) => push("error", t),
      success: (t) => push("success", t),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.kind === "error" ? <IconAlert /> : t.kind === "success" ? <IconCheck /> : null}
            <span>{t.text}</span>
            <button className="toast__x" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} aria-label="Kapat">
              <IconX width={14} height={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("ToastProvider eksik");
  return v;
}
