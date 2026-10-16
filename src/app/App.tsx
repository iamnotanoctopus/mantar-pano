import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATUS_DONE, STATUS_TODO, type Task, type TaskInput } from "@shared/types";
import { ApiError, appKey } from "@/data/http";
import { Gate } from "@/components/Gate";
import { BottomNav, Header } from "@/components/Header";
import { TaskDrawer, type DrawerState } from "@/components/TaskDrawer";
import { IconAlert, IconRefresh } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useNudge } from "@/hooks/useNudge";
import { useSound } from "@/hooks/useSound";
import { useCreateTask, useMeta, useSchema, useTasks, useUpdateTask } from "@/hooks/useTasks";
import { today } from "@/lib/dates";
import { isDone, type ViewId } from "@/lib/views";
import { usePrefs } from "@/state/prefs";
import { AllView } from "@/views/AllView";
import { BoardView } from "@/views/BoardView";
import { CalendarView } from "@/views/CalendarView";
import { TodayView } from "@/views/TodayView";
import { UpcomingView } from "@/views/UpcomingView";
import "./App.css";

interface DrawerRef {
  mode: "edit" | "create";
  taskId?: string;
  draft?: Partial<TaskInput>;
}

export default function App() {
  const { showNotes, nudgeOnOverdue } = usePrefs();
  const [view, setView] = useState<ViewId>("board");
  const play = useSound();
  const nudge = useNudge();
  const toast = useToast();
  const schema = useSchema();
  const meta = useMeta();
  const tasksQ = useTasks();
  const update = useUpdateTask();
  const create = useCreateTask();

  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<DrawerRef | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const tasks = useMemo(() => tasksQ.data?.tasks ?? [], [tasksQ.data]);

  /* Çekmece: kart verisini listeden canlı türet (optimistic güncellemeler yansısın) */
  const drawerState: DrawerState | null = useMemo(() => {
    if (!drawer) return null;
    if (drawer.mode === "create") return { mode: "create", draft: drawer.draft };
    const task = tasks.find((t) => t.id === drawer.taskId);
    return task ? { mode: "edit", task } : null;
  }, [drawer, tasks]);

  const openTask = useCallback((t: Task) => setDrawer({ mode: "edit", taskId: t.id }), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const newCard = useCallback(
    (draft: Partial<TaskInput> = {}) => {
      const base: Partial<TaskInput> = view === "today" ? { date: today() } : {};
      setDrawer({ mode: "create", draft: { ...base, ...draft } });
    },
    [view],
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
    (input: TaskInput) => {
      play("pin");
      create.mutate({ status: STATUS_TODO, priority: "Orta", ...input });
    },
    [create, play],
  );

  const moveArea = useCallback(
    (t: Task, area: string | null) => {
      play("pop");
      update.mutate({ id: t.id, patch: { area } });
    },
    [update, play],
  );

  /* MSN usulü dürtme: elle (D / buton) ya da açılışta gecikmiş kart varsa (oturumda bir kez) */
  const doNudge = useCallback(() => {
    nudge();
  }, [nudge]);

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

  /* Klavye kısayolları */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || drawer || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        newCard();
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        doNudge();
      } else if (e.key >= "1" && e.key <= "5") {
        const ids = ["board", "today", "upcoming", "calendar", "all"] as const;
        setView(ids[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, newCard, setView, doNudge]);

  const error = tasksQ.isError ? (tasksQ.error as Error).message : null;
  const common = { tasks, schema, query, showNotes, onOpen: openTask, onToggleDone: toggleDone };

  /* Şifre korumalı sunucu: 401 gelirse giriş ekranı */
  const authErr = [meta.error, tasksQ.error].find((e) => e instanceof ApiError && e.status === 401);
  if (authErr) return <Gate wrong={Boolean(appKey.get())} />;

  return (
    <>
      <div className="app">
        <Header
          query={query}
          onQuery={setQuery}
          onNew={() => newCard()}
          onNudge={doNudge}
          syncedAt={meta.data?.lastSyncAt ?? tasksQ.data?.syncedAt ?? null}
          fetching={tasksQ.isFetching}
          error={error}
          searchRef={searchRef}
          view={view}
          setView={setView}
        />

        <main className="main">
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
          ) : view === "board" ? (
            <BoardView
              {...common}
              onQuickAdd={(title, area) => quickAdd({ title, area })}
              onNewWithDraft={(d) => newCard(d)}
              onMoveArea={moveArea}
            />
          ) : view === "today" ? (
            <TodayView {...common} onQuickAdd={(title, date) => quickAdd({ title, date })} onNew={() => newCard({ date: today() })} />
          ) : view === "upcoming" ? (
            <UpcomingView {...common} />
          ) : view === "calendar" ? (
            <CalendarView {...common} onQuickAdd={(title, date) => quickAdd({ title, date })} />
          ) : (
            <AllView {...common} />
          )}
        </main>
      </div>

      <BottomNav onNew={() => newCard()} view={view} setView={setView} />
      <TaskDrawer state={drawerState} schema={schema} onClose={closeDrawer} onCreated={() => play("pin")} onDeleted={() => play("delete")} />
    </>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Yükleniyor">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton__col">
          <div className="skeleton__line" style={{ width: "40%" }} />
          <div className="skeleton__card" />
          <div className="skeleton__card" style={{ height: 70 }} />
          <div className="skeleton__card" style={{ height: 56 }} />
        </div>
      ))}
    </div>
  );
}
