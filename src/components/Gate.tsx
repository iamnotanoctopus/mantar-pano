import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { appKey } from "@/data/http";
import { LogoMark } from "./Logo";
import "./Gate.css";

/** APP_PASSWORD tanımlı sunucular için tek seferlik şifre ekranı. */
export function Gate({ wrong }: { wrong: boolean }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    appKey.set(value.trim());
    void qc.invalidateQueries();
  };

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={submit}>
        <LogoMark size={36} />
        <h1 className="gate__title">Mantar Pano</h1>
        <p className="muted">Bu pano şifreyle korunuyor.</p>
        <input
          className="input"
          type="password"
          autoFocus
          placeholder="Şifre"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Şifre"
          autoComplete="current-password"
        />
        {wrong && <p className="gate__error">Şifre yanlış, tekrar dene.</p>}
        <button className="btn btn--primary" type="submit" disabled={!value.trim()}>
          Panoyu aç
        </button>
      </form>
    </div>
  );
}
