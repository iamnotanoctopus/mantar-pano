import "./Switch.css";

/** Açma/kapama anahtarı: gerçek <button role="switch">, klavyeyle Boşluk/Enter. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <i className="switch__knob" aria-hidden />
    </button>
  );
}
