import { useEffect, useRef, useState } from "react";
import { IconPlus } from "./icons";
import "./QuickAdd.css";

interface Props {
  placeholder?: string;
  label?: string;
  onAdd: (title: string) => void;
  /** Ayrıntılı ekleme (çekmece) için */
  onMore?: (title: string) => void;
}

/** Sütun altındaki hızlı ekleme: başlık yaz, Enter'a bas, kart iğnelenir. */
export function QuickAdd({ placeholder = "Kart başlığı…", label = "Kart ekle", onAdd, onMore }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  const submit = () => {
    const t = value.trim();
    if (!t) {
      setOpen(false);
      return;
    }
    onAdd(t);
    setValue("");
    ref.current?.focus();
  };

  if (!open) {
    return (
      <button type="button" className="quickadd__btn" onClick={() => setOpen(true)}>
        <IconPlus width={15} height={15} />
        {label}
      </button>
    );
  }

  return (
    <form
      className="quickadd"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        ref={ref}
        className="quickadd__input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!value.trim()) setOpen(false);
        }}
        aria-label={placeholder}
      />
      <div className="quickadd__row">
        <button type="submit" className="btn btn--primary btn--sm">
          İğnele
        </button>
        {onMore && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onMore(value.trim());
              setValue("");
              setOpen(false);
            }}
          >
            Ayrıntılar…
          </button>
        )}
        <span className="grow" />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setValue("");
            setOpen(false);
          }}
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
