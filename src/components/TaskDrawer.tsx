import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { STATUS_TODO, type Schema, type Task, type TaskInput, type TaskPatch } from "@shared/types";
import { useCreateTask, useDeleteTask, useUpdateTask } from "@/hooks/useTasks";
import { addDays, dayLabel, fromISODate, longDate, relativeTime, toISODate, today } from "@/lib/dates";
import { colorVar } from "@/lib/format";
import { IconCheck, IconExternal, IconTrash, IconX } from "./icons";
import "./TaskDrawer.css";

export interface DrawerState {
  mode: "edit" | "create";
  task?: Task;
  draft?: Partial<TaskInput>;
}

interface Props {
  state: DrawerState | null;
  schema: Schema;
  onClose: () => void;
  /** Kart oluşturma isteği gönderildiğinde (ses efekti vb.) */
  onCreated?: () => void;
  /** Kart kaldırma isteği gönderildiğinde */
  onDeleted?: () => void;
}

interface Form {
  title: string;
  area: string | null;
  status: string;
  priority: string | null;
  date: string | null;
  duration: number | null;
  note: string;
}

const DURATIONS = [15, 30, 45, 60, 90];

function formFrom(task?: Task, draft?: Partial<TaskInput>): Form {
  if (task) {
    return {
      title: task.title,
      area: task.area,
      status: task.status,
      priority: task.priority,
      date: task.date,
      duration: task.duration,
      note: task.note,
    };
  }
  return {
    title: draft?.title ?? "",
    area: draft?.area ?? null,
    status: draft?.status ?? STATUS_TODO,
    priority: draft?.priority ?? "Orta",
    date: draft?.date ?? null,
    duration: draft?.duration ?? null,
    note: draft?.note ?? "",
  };
}

function nextSaturday(base: string): string {
  const d = fromISODate(base);
  const dow = d.getDay(); // 0=Paz, 6=Cmt
  const delta = dow === 6 ? 7 : (6 - dow + 7) % 7 || 7;
  return addDays(base, delta);
}

export function TaskDrawer({ state, schema, onClose, onCreated, onDeleted }: Props) {
  const open = state !== null;
  const task = state?.task;
  const mode = state?.mode ?? "edit";
  const [form, setForm] = useState<Form>(() => formFrom(task, state?.draft));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const lastSaved = useRef<Form>(form);
  const key = task?.id ?? (state ? "create" : "none");

  const update = useUpdateTask();
  const create = useCreateTask();
  const remove = useDeleteTask();

  /* Kart değişince formu sıfırla */
  useLayoutEffect(() => {
    const f = formFrom(task, state?.draft);
    setForm(f);
    lastSaved.current = f;
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  useEffect(() => {
    if (open) window.setTimeout(() => titleRef.current?.focus({ preventScroll: true }), mode === "create" ? 60 : 0);
  }, [open, key, mode]);

  /* Başlık alanını içeriğe göre büyüt */
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [form.title, open]);

  const diffFrom = useCallback((a: Form, b: Form): TaskPatch => {
    const p: TaskPatch = {};
    if (a.title.trim() !== b.title.trim()) p.title = a.title.trim();
    if (a.area !== b.area) p.area = a.area;
    if (a.status !== b.status) p.status = a.status;
    if (a.priority !== b.priority) p.priority = a.priority;
    if (a.date !== b.date) p.date = a.date;
    if (a.duration !== b.duration) p.duration = a.duration;
    if (a.note !== b.note) p.note = a.note;
    return p;
  }, []);

  /** Düzenleme modunda farkları Notion'a yaz. */
  const commit = useCallback(
    (next: Form) => {
      if (mode !== "edit" || !task) return;
      const patch = diffFrom(next, lastSaved.current);
      if (patch.title !== undefined && !patch.title) delete patch.title; // boş başlık kaydetme
      if (Object.keys(patch).length === 0) return;
      lastSaved.current = { ...lastSaved.current, ...next };
      update.mutate({ id: task.id, patch });
    },
    [mode, task, diffFrom, update],
  );

  /* Seçim türü alanlar anında, metin alanları gecikmeli kaydedilir */
  const set = (patch: Partial<Form>, immediate = false) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (immediate) commit(next);
  };

  useEffect(() => {
    if (mode !== "edit") return;
    const t = window.setTimeout(() => commit(form), 650);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, form.note, form.duration]);

  const close = () => {
    if (mode === "edit") commit(form);
    onClose();
  };

  const submitCreate = () => {
    const title = form.title.trim();
    if (!title) {
      titleRef.current?.focus();
      return;
    }
    create.mutate({
      title,
      area: form.area,
      status: form.status,
      priority: form.priority,
      date: form.date,
      duration: form.duration,
      note: form.note,
    });
    onCreated?.();
    onClose();
  };

  /* Klavye */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && mode === "create") {
        e.preventDefault();
        submitCreate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form, mode]);

  const area = schema.areas.find((a) => a.name === form.area);
  const day = useMemo(() => dayLabel(form.date), [form.date]);
  const t0 = today();

  const saving = update.isPending;
  const saveLabel =
    mode === "create" ? null : saving ? "Kaydediliyor…" : update.isError ? "Kaydedilemedi" : update.isSuccess ? "Kaydedildi" : null;

  return (
    <>
      <div className={`drawer-backdrop ${open ? "is-open" : ""}`} onClick={close} aria-hidden />
      <aside
        className={`drawer ${open ? "is-open" : ""}`}
        style={{ "--c": colorVar(area?.color) } as React.CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Yeni kart" : "Kart ayrıntıları"}
        aria-hidden={!open}
      >
        <div className="drawer__bar" />
        <header className="drawer__head">
          <span className="drawer__kicker">
            {mode === "create" ? "Yeni kart" : area ? area.name : "Kart"}
            {saveLabel && (
              <span className={`drawer__save ${saving ? "is-saving" : ""} ${update.isError ? "is-error" : ""}`}>
                {!saving && !update.isError && <IconCheck width={12} height={12} strokeWidth={2.6} />}
                {saveLabel}
              </span>
            )}
          </span>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={close} aria-label="Kapat">
            <IconX />
          </button>
        </header>

        <div className="drawer__scroll">
          <textarea
            ref={titleRef}
            className="drawer__title"
            rows={1}
            value={form.title}
            placeholder="Kartın başlığı…"
            onChange={(e) => set({ title: e.target.value.replace(/\n/g, " ") })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (mode === "create") submitCreate();
                else (e.target as HTMLTextAreaElement).blur();
              }
            }}
            onBlur={() => mode === "edit" && commit(form)}
          />

          <section className="field">
            <span className="field__label">Durum</span>
            <div className="chips" role="radiogroup" aria-label="Durum">
              {schema.statuses.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className="chip"
                  style={{ "--c": colorVar(s.color) } as React.CSSProperties}
                  aria-pressed={form.status === s.name}
                  onClick={() => set({ status: s.name }, true)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </section>

          <section className="field">
            <span className="field__label">Alan</span>
            <div className="chips" role="radiogroup" aria-label="Alan">
              {schema.areas.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  className="chip"
                  style={{ "--c": colorVar(a.color) } as React.CSSProperties}
                  aria-pressed={form.area === a.name}
                  onClick={() => set({ area: form.area === a.name ? null : a.name }, true)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </section>

          <section className="field">
            <span className="field__label">Öncelik</span>
            <div className="chips" role="radiogroup" aria-label="Öncelik">
              {schema.priorities.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="chip"
                  style={{ "--c": colorVar(p.color) } as React.CSSProperties}
                  aria-pressed={form.priority === p.name}
                  onClick={() => set({ priority: form.priority === p.name ? null : p.name }, true)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          <section className="field">
            <span className="field__label">
              Tarih
              {form.date && (
                <span className={`drawer__daylabel tag tag--day tag--${day.tone}`}>
                  {day.label} · {longDate(form.date)}
                </span>
              )}
            </span>
            <div className="row">
              <input
                type="date"
                className="input"
                value={form.date ?? ""}
                onChange={(e) => set({ date: e.target.value || null }, true)}
                aria-label="Tarih"
              />
            </div>
            <div className="chips">
              <button type="button" className="chip chip--plain" aria-pressed={form.date === t0} onClick={() => set({ date: t0 }, true)}>
                Bugün
              </button>
              <button
                type="button"
                className="chip chip--plain"
                aria-pressed={form.date === addDays(t0, 1)}
                onClick={() => set({ date: addDays(t0, 1) }, true)}
              >
                Yarın
              </button>
              <button
                type="button"
                className="chip chip--plain"
                aria-pressed={form.date === nextSaturday(t0)}
                onClick={() => set({ date: nextSaturday(t0) }, true)}
              >
                Hafta sonu
              </button>
              <button
                type="button"
                className="chip chip--plain"
                aria-pressed={form.date === addDays(t0, 7)}
                onClick={() => set({ date: addDays(t0, 7) }, true)}
              >
                +1 hafta
              </button>
              {form.date && (
                <button type="button" className="chip chip--plain" onClick={() => set({ date: null }, true)}>
                  Temizle
                </button>
              )}
            </div>
          </section>

          <section className="field">
            <span className="field__label">Süre (dk)</span>
            <div className="row">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={5}
                className="input"
                style={{ width: 120 }}
                value={form.duration ?? ""}
                placeholder="—"
                onChange={(e) => set({ duration: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                onBlur={() => mode === "edit" && commit(form)}
                aria-label="Süre (dakika)"
              />
              <div className="chips">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="chip chip--plain"
                    aria-pressed={form.duration === d}
                    onClick={() => set({ duration: form.duration === d ? null : d }, true)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="field">
            <span className="field__label">Not</span>
            <textarea
              className="textarea"
              value={form.note}
              placeholder="Ayrıntı, bağlantı, hatırlatma…"
              onChange={(e) => set({ note: e.target.value })}
              onBlur={() => mode === "edit" && commit(form)}
              rows={5}
            />
          </section>

          {task && (
            <footer className="drawer__foot">
              <div className="drawer__times muted">
                <span>Oluşturuldu {relativeTime(task.createdTime)}</span>
                <span>· Düzenlendi {relativeTime(task.lastEditedTime)}</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                {task.url ? (
                  <a className="btn btn--sm" href={task.url} target="_blank" rel="noreferrer">
                    <IconExternal /> Notion'da aç
                  </a>
                ) : (
                  <span />
                )}
                {confirmDelete ? (
                  <span className="row">
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      Kart Notion'da arşivlenecek.
                    </span>
                    <button
                      className="btn btn--sm btn--danger"
                      onClick={() => {
                        remove.mutate(task.id);
                        onDeleted?.();
                        onClose();
                      }}
                    >
                      Sil
                    </button>
                    <button className="btn btn--sm btn--ghost" onClick={() => setConfirmDelete(false)}>
                      Vazgeç
                    </button>
                  </span>
                ) : (
                  <button className="btn btn--sm btn--ghost btn--danger" onClick={() => setConfirmDelete(true)}>
                    <IconTrash /> Kaldır
                  </button>
                )}
              </div>
            </footer>
          )}
        </div>

        {mode === "create" && (
          <div className="drawer__actions">
            <span className="muted hide-mobile" style={{ fontSize: 12 }}>
              <kbd>Enter</kbd> iğnele · <kbd>Esc</kbd> vazgeç
            </span>
            <span className="grow" />
            <button className="btn btn--ghost" onClick={onClose}>
              Vazgeç
            </button>
            <button className="btn btn--primary" onClick={submitCreate} disabled={!form.title.trim()}>
              Kartı iğnele
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export const todayISO = () => toISODate(new Date());
