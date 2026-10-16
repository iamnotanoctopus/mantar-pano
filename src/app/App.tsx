import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig } from "motion/react";
import { STATUS_DONE, STATUS_TODO, type Task, type TaskInput, type TaskPatch } from "@shared/types";
import { ApiError, appKey } from "@/data/http";
import { Board } from "@/board/Board";
import { applyFilters, buildLayout, dropPatch, filtersActive } from "@/board/layouts";
import { Capsule, FOCUS_DEFS, WeekNav } from "@/components/Capsule";
import { DatePopover } from "@/components/DatePopover";
import { FilterMenu } from "@/components/FilterMenu";
import { Gate } from "@/components/Gate";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { TaskDrawer, type DrawerState } from "@/components/TaskDrawer";
import { TopBar } from "@/components/TopBar";
import { IconAlert, IconRefresh } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useNudge } from "@/hooks/useNudge";
import { useSound } from "@/hooks/useSound";
import { useCreateTask, useMeta, useSchema, useTasks, useUpdateTask } from "@/hooks/useTasks";
import { addDays, startOfWeek, today } from "@/lib/dates";
import { plural } from "@/lib/format";
import { SPRING } from "@/lib/physics";
import { isDone, type Horizon } from "@/lib/views";
import { usePrefs, type Focus } from "@/state/prefs";
import "./App.css";

interface DrawerRef {
  mode: "edit" | "create";
  taskId?: string;
  draft?: Partial<TaskInput>;
}

export default function App() {
  const { showNotes, nudgeOnOverdue, focus, setFocus, filters, setFilters, showDone, setShowDone } = usePrefs();
  const play = useSound();
  const nudge = useNudge();
  const toast = useToast();
  const schema = useSchema();
  const meta = useMeta();
  const tasksQ = useTasks();
  const update = useUpdateTask();
  const create = useCreateTask();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()));
  /* Takvimde seçilen gün: Hafta odağında pano o günün şeridine kayar */
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  /* Aynı gün yeniden seçilse de pano o şeride yeniden kaysın */
  const [pickSeq, setPickSeq] = useState(0);
  const [drawer, setDrawer] = useState<DrawerRef | null>(null);
  /* Kart eklendi / iğnelendi: logo seker */
  const [pinPulse, setPinPulse] = useState(0);
  const pinned = useCallback(() => setPinPulse((n) => n + 1), []);

  const searchRef = useRef<HTMLInputElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const dateBtnRef2 = useRef<HTMLButtonElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  const tasks = useMemo(() => tasksQ.data?.tasks ?? [], [tasksQ.data]);
  /*
   * "Bugün" her çizimde yeniden okunur: sekme gece yarısını açık geçirirse (periyodik yenileme App'i yeniden çizer)
   * Bugün/Yarın şeritleri ve hızlı ekleme dünün tarihinde kalmaz.
   */
  const t0 = today();
  const h = useMemo<Horizon>(() => ({ today: t0, weekAhead: addDays(t0, 7) }), [t0]);
  const thisWeek = startOfWeek(t0);
  const prevWeek = useRef(thisWeek);
  useEffect(() => {
    if (prevWeek.current === thisWeek) return;
    // Hafta odağı "bu hafta"daysa yeni haftaya geçer; elle başka haftaya gidildiyse dokunulmaz
    const was = prevWeek.current;
    prevWeek.current = thisWeek;
    setWeekStart((ws) => (ws === was ? thisWeek : ws));
  }, [thisWeek]);
  const layout = useMemo(() => buildLayout({ tasks, schema, focus, filters, showDone, query, weekStart, h }), [tasks, schema, focus, filters, showDone, query, weekStart, h]);
  const filterCount = filters.areas.length + filters.priorities.length + (showDone ? 1 : 0);

  /* Çekmece: kart verisini listeden canlı türet (optimistic güncellemeler yansısın) */
  const drawerState: DrawerState | null = useMemo(() => {
    if (!drawer) return null;
    if (drawer.mode === "create") return { mode: "create", draft: drawer.draft };
    const task = tasks.find((t) => t.id === drawer.taskId);
    return task ? { mode: "edit", task } : null;
  }, [drawer, tasks]);

  const openTask = useCallback((t: Task) => setDrawer({ mode: "edit", taskId: t.id }), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  /** Yeni kart: odağa göre varsayılan tarih (Bugün → bugün, Hafta → bu haftadaysa bugün, değilse haftanın ilk günü) */
  const newCard = useCallback(
    (draft: Partial<TaskInput> = {}) => {
      const t0 = today();
      const base: Partial<TaskInput> =
        focus === "today" ? { date: t0 } : focus === "week" ? { date: startOfWeek(t0) === weekStart ? t0 : weekStart } : {};
      setDrawer({ mode: "create", draft: { ...base, ...draft } });
    },
    [focus, weekStart],
  );

  const toggleDone = useCallback(
    (t: Task) => {
      const done = t.status === STATUS_DONE;
      play(done ? "undo" : "done");
      update.mutate({ id: t.id, patch: { status: done ? STATUS_TODO : STATUS_DONE } });
    },
    [update, play],
  );

  const quickAdd = useCallback(
    (title: string, patch: TaskPatch) => {
      play("pin");
      pinned();
      create.mutate({ status: STATUS_TODO, priority: "Orta", ...patch, title });
    },
    [create, play, pinned],
  );

  /**
   * Kart başka şeride bırakıldı: alanı ya da tarihi değişir (dropPatch); raptiye saplanır.
   * Bir şey değiştiyse true döner (değişmediyse pano kartı eski yerine geri yaylar).
   */
  const dropCard = useCallback(
    (t: Task, patch: TaskPatch): boolean => {
      const next = dropPatch(t, patch);
      if (!next) return false;
      play("pin");
      pinned();
      update.mutate({ id: t.id, patch: next });
      return true;
    },
    [update, play, pinned],
  );

  const changeFocus = useCallback(
    (f: Focus) => {
      setFocus(f);
      if (f !== "week") setDateOpen(false);
    },
    [setFocus],
  );

  /* MSN usulü dürtme: elle (D / ayarlar) ya da açılışta gecikmiş kart varsa (oturumda bir kez) */
  const nudgedRef = useRef(false);
  useEffect(() => {
    if (!nudgeOnOverdue || nudgedRef.current || !tasksQ.data) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem("mp.nudged") === "1";
    } catch {
      /* yok say */
    }
    if (seen) return;
    const t0 = today();
    const overdue = tasks.filter((t) => !isDone(t) && t.date !== null && t.date < t0).length;
    if (overdue === 0) return;
    nudgedRef.current = true;
    try {
      sessionStorage.setItem("mp.nudged", "1");
    } catch {
      /* yok say */
    }
    const id = window.setTimeout(() => {
      nudge();
      toast.info(`${overdue} kart gecikmiş — bir dürtme hak ettin.`);
    }, 900);
    return () => window.clearTimeout(id);
  }, [tasksQ.data, tasks, nudgeOnOverdue, nudge, toast]);

  /* Klavye kısayolları: N yeni · / ara · D dürt · 1 2 3 odak · T takvim (Hafta) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing || drawer || settingsOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLocaleLowerCase("tr-TR");
      if (k === "n") {
        e.preventDefault();
        newCard();
      } else if (k === "/") {
        e.preventDefault();
        setSearchOpen(true);
        searchRef.current?.focus();
      } else if (k === "d") {
        e.preventDefault();
        nudge();
      } else if (k === "t") {
        e.preventDefault();
        changeFocus("week");
        setFilterOpen(false);
        setDateOpen(true);
      } else {
        const def = FOCUS_DEFS.find((f) => f.key === e.key);
        if (def) {
          e.preventDefault();
          changeFocus(def.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, settingsOpen, newCard, nudge, changeFocus]);

  const error = tasksQ.isError ? (tasksQ.error as Error).message : null;

  /* Şifre korumalı sunucu: 401 gelirse giriş ekranı */
  const authErr = [meta.error, tasksQ.error].find((e) => e instanceof ApiError && e.status === 401);
  if (authErr) return <Gate wrong={Boolean(appKey.get())} />;

  const active = filtersActive(filters, showDone) || Boolean(query.trim());
  const focusLabel = FOCUS_DEFS.find((f) => f.id === focus)!.label;
  const note =
    tasksQ.data && layout.hidden > 0 ? `${focus !== "areas" || active ? `${focusLabel} odağı · ` : ""}${plural(layout.hidden, "kart")} odak dışında` : null;
  const empty = !tasksQ.data
    ? null
    : layout.shown > 0
      ? null
      : query.trim()
        ? "Aramana uyan kart yok."
        : filtersActive(filters, showDone)
          ? "Süzgece uyan kart yok."
          : focus === "today"
            ? "Bugün için pano temiz."
            : focus === "week"
              ? "Bu hafta için iğnelenmiş kart yok."
              : "Panoda kart yok — bir şeride kart ekleyerek başla.";

  const weekProps = {
    weekStart,
    onWeek: setWeekStart,
    dateOpen,
    onDateToggle: () => {
      setFilterOpen(false);
      setDateOpen((o) => !o);
    },
  };

  /* Odak değişince pano başa kayar; Hafta'da takvimde seçilen güne, yoksa (bu haftaysa) bugüne */
  const anchor =
    focus !== "week" ? null : pickedDay && startOfWeek(pickedDay) === weekStart ? `day:${pickedDay}` : thisWeek === weekStart ? `day:${t0}` : null;

  return (
    // Tüm Motion geçişleri varsayılan yayla; "hareketi azalt" açıksa dönüşümler anında
    <MotionConfig reducedMotion="user" transition={SPRING}>
      {/* Ayarlar çekmecesi açıkken (aria-modal) arka plan etkileşimsiz: odak ve ekran okuyucu çekmecede kalır */}
      <div className="app" data-focus={focus} data-note={note ? "" : undefined} inert={settingsOpen || undefined}>
        <TopBar
          pinPulse={pinPulse}
          syncedAt={meta.data?.lastSyncAt ?? tasksQ.data?.syncedAt ?? null}
          fetching={tasksQ.isFetching}
          error={error}
          count={tasks.length}
          settingsOpen={settingsOpen}
          onSettings={() => setSettingsOpen((o) => !o)}
          gearRef={gearRef}
        >
          <div className="dock">
            <Capsule
              focus={focus}
              onFocus={changeFocus}
              query={query}
              onQuery={setQuery}
              searchOpen={searchOpen}
              onSearchOpen={setSearchOpen}
              searchRef={searchRef}
              filterCount={filterCount}
              filterOpen={filterOpen}
              onFilterToggle={() => {
                setDateOpen(false);
                setFilterOpen((o) => !o);
              }}
              filterBtnRef={filterBtnRef}
              dateBtnRef={dateBtnRef}
              onNew={() => newCard()}
              {...weekProps}
            />
            <FilterMenu
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              anchorRef={filterBtnRef}
              schema={schema}
              filters={filters}
              onFilters={setFilters}
              showDone={showDone}
              onShowDone={setShowDone}
              shown={layout.shown}
            />
            <DatePopover
              open={dateOpen && focus === "week"}
              onClose={() => setDateOpen(false)}
              anchorRefs={[dateBtnRef, dateBtnRef2]}
              weekStart={weekStart}
              onPick={(iso) => {
                setPickedDay(iso);
                setPickSeq((n) => n + 1);
                setWeekStart(startOfWeek(iso));
              }}
              tasks={applyFilters(tasks, { filters, showDone, query })}
              schema={schema}
            />
            {note && (
              <p className="dock__note" role="status">
                {note}
                {filtersActive(filters, showDone) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({ areas: [], priorities: [] });
                      setShowDone(false);
                    }}
                  >
                    Süzgeci temizle
                  </button>
                )}
              </p>
            )}
            {focus === "week" && <WeekNav className="dock__week" dateBtnRef={dateBtnRef2} {...weekProps} />}
          </div>
        </TopBar>

        {error && (
          <div className="banner banner--error">
            <IconAlert />
            <span className="grow">
              {error}
              {tasks.length > 0 && " — son eşitlenen kopya gösteriliyor."}
            </span>
            <button className="btn btn--sm" onClick={() => tasksQ.refetch()}>
              <IconRefresh /> Tekrar dene
            </button>
          </div>
        )}

        {!tasksQ.data && !error ? (
          <Skeleton />
        ) : (
          <Board
            lanes={layout.lanes}
            tasks={tasks}
            schema={schema}
            showNotes={showNotes && focus === "areas"}
            empty={empty}
            focusKey={focus === "week" ? `week:${weekStart}:${pickSeq}` : focus}
            anchor={anchor}
            onOpen={openTask}
            onToggleDone={toggleDone}
            onDrop={dropCard}
            onQuickAdd={quickAdd}
            onNewWithDraft={(d) => newCard(d)}
          />
        )}
      </div>

      <AnimatePresence>{settingsOpen && <SettingsDrawer key="settings" onClose={() => setSettingsOpen(false)} onNudge={nudge} returnFocus={gearRef} />}</AnimatePresence>
      <TaskDrawer
        state={drawerState}
        schema={schema}
        onClose={closeDrawer}
        onCreated={() => {
          play("pin");
          pinned();
        }}
        onDeleted={() => play("delete")}
      />
    </MotionConfig>
  );
}

function Skeleton() {
  return (
    <section className="board" aria-busy="true" aria-label="Yükleniyor">
      <div className="skeleton">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton__col">
            <div className="skeleton__line" style={{ width: "46%" }} />
            <div className="skeleton__card" />
            <div className="skeleton__card" style={{ height: 70 }} />
            <div className="skeleton__card" style={{ height: 56 }} />
          </div>
        ))}
      </div>
    </section>
  );
}
