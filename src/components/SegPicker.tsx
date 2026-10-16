import { useId } from "react";
import { motion } from "motion/react";
import "./SegPicker.css";

/** Küçük bölümlü seçici (radyo grubu). Seçili hap layoutId ile yaylanarak kayar. */
export function SegPicker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <span className="segp" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} title={o.hint} className="segp__opt" onClick={() => onChange(o.id)}>
          {value === o.id && <motion.span layoutId={`segp-${id}`} className="segp__pill" aria-hidden />}
          <span className="segp__label">{o.label}</span>
        </button>
      ))}
    </span>
  );
}
