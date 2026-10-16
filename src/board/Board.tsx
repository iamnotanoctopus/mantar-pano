import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  defaultDropAnimationSideEffects,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";
import type { Schema, Task, TaskPatch } from "@shared/types";
import { TaskCard } from "@/components/TaskCard";
import { QuickAdd } from "@/components/QuickAdd";
import { PHONE, useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDuration } from "@/lib/format";
import { EDGE_ELASTIC, INERTIA, INSTANT, LIFT, SPRING, SPRING_FALLBACK_EASING, springEasing, supportsLinearEasing } from "@/lib/physics";
import type { Lane } from "./layouts";
import "./Board.css";

interface Props {
  lanes: Lane[];
  schema: Schema;
  showNotes: boolean;
  empty: string | null;
  /** Odak anahtarı: değişince pano başa (ya da bugüne) kayar */
  focusKey: string;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onDrop: (t: Task, patch: TaskPatch) => void;
  onQuickAdd: (title: string, patch: TaskPatch) => void;
  onNewWithDraft: (draft: TaskPatch & { title?: string }) => void;
}

const LANE_TILTS = [-0.7, 0.5, -0.4, 0.6, -0.5, 0.4, -0.6, 0.5];
/** Panı başlatmayan öğeler: kartlar ve kontroller (pan yalnızca boş pano yüzeyinde başlar) */
const NO_PAN = ".card, .card-slot, button, input, textarea, select, a, label, .quickadd, .lane__label";
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Bounds {
  left: number;
  top: number;
}

/** Başka şeride bırakılan kart: bırakıldığı yer, ölçek ve eğimle iner (dnd-kit'in geri dönüş animasyonu yerine) */
interface Landing {
  id: string;
  left: number;
  top: number;
  scale: number;
  rotate: number;
}

/**
 * Tek mantar pano. Masaüstünde boş yüzeyden sürükleyerek kaydırılır (Motion drag + inertia, kenarda direnç);
 * telefonda şeritler yatay scroll-snap ile kayar. Odak/süzgeç değişince kartlar layout yayıyla yeni şeride geçer,
 * çıkanlar söner. Kartlar dnd-kit ile tutulur: yükselir, eğilir; bırakılınca yerine yaylanır, raptiye saplanır.
 */
export function Board({ lanes, schema, showNotes, empty, focusKey, onOpen, onToggleDone, onDrop, onQuickAdd, onNewWithDraft }: Props) {
  const phone = useMediaQuery(PHONE);
  const reduce = Boolean(useReducedMotion());
  const viewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const controls = useDragControls();
  const [bounds, setBounds] = useState<Bounds>({ left: 0, top: 0 });
  const [panning, setPanning] = useState(false);
  const pan = !phone;

  /* Pano sınırları: içerik görünümden büyükse o kadar kaydırılabilir */
  useLayoutEffect(() => {
    const vp = viewRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    const measure = () => {
      const b = { left: Math.min(0, vp.clientWidth - ct.offsetWidth), top: Math.min(0, vp.clientHeight - ct.offsetHeight) };
      setBounds((old) => (old.left === b.left && old.top === b.top ? old : b));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(ct);
    return () => ro.disconnect();
  }, []);

  /* Sınır daralırsa (ör. daha az şerit) pano yaylanarak içeri döner */
  useEffect(() => {
    if (!pan) {
      x.set(0);
      y.set(0);
      return;
    }
    const t = reduce ? INSTANT : SPRING;
    if (x.get() < bounds.left) animate(x, bounds.left, t);
    if (y.get() < bounds.top) animate(y, bounds.top, t);
  }, [bounds, pan, reduce, x, y]);

  /* Odak değişti: başa kay; Hafta'da bugünün şeridi görünsün */
  useEffect(() => {
    const vp = viewRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    const today = ct.querySelector<HTMLElement>('.lane[data-tone="today"]');
    const target = today && focusKey === "week" ? Math.max(0, today.offsetLeft - 32) : 0;
    if (pan) {
      const t = reduce ? INSTANT : SPRING;
      animate(x, clamp(-target, Math.min(0, vp.clientWidth - ct.offsetWidth), 0), t);
      animate(y, 0, t);
    } else {
      vp.scrollTo({ left: target ? target + 16 : 0, behavior: reduce ? "auto" : "smooth" });
    }
    // yalnızca odak değişiminde çalışır (diğer değerler o anki hâlleriyle okunur)
  }, [focusKey]);

  /* Trackpad/tekerlek: iki parmakla kaydırma panoyu kaydırır */
  useEffect(() => {
    const vp = viewRef.current;
    if (!vp || !pan) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vp.clientHeight : 1;
      let dx = (e.shiftKey ? e.deltaY : e.deltaX) * k;
      let dy = (e.shiftKey ? 0 : e.deltaY) * k;
      if (bounds.top === 0 && dx === 0) {
        dx = dy; // dikey taşma yoksa tekerlek yatay kaydırır
        dy = 0;
      }
      if (!dx && !dy) return;
      e.preventDefault();
      x.stop();
      y.stop();
      x.set(clamp(x.get() - dx, bounds.left, 0));
      y.set(clamp(y.get() - dy, bounds.top, 0));
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [pan, bounds, x, y]);

  /* Klavyeyle odaklanan kart görünüm dışındaysa tarayıcının yerel kaydırmasını pana çevir */
  const onNativeScroll = useCallback(() => {
    const vp = viewRef.current;
    if (!vp || !pan || (vp.scrollLeft === 0 && vp.scrollTop === 0)) return;
    x.set(clamp(x.get() - vp.scrollLeft, bounds.left, 0));
    y.set(clamp(y.get() - vp.scrollTop, bounds.top, 0));
    vp.scrollLeft = 0;
    vp.scrollTop = 0;
  }, [pan, bounds, x, y]);

  /* ----------------------------------------------------------- Sürükle-bırak */
  const [active, setActive] = useState<Task | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  /* "return": iptal / aynı şerit → dnd-kit kartı yayla eski yerine götürür · "land": kart yeni şeritte iner */
  const [dropMode, setDropMode] = useState<"return" | "land">("return");
  const landed = landing?.id ?? null;
  const liftScale = useMotionValue(1);
  const liftRotate = useMotionValue(0);
  const dir = useRef(0);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const dropAnimation = useMemo<DropAnimation | null>(() => {
    if (reduce) return null;
    const s = springEasing();
    return {
      duration: s.duration,
      easing: supportsLinearEasing() ? s.easing : SPRING_FALLBACK_EASING,
      sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
    };
  }, [reduce]);

  const onDragStart = (e: DragStartEvent) => {
    setActive((e.active.data.current?.task as Task | undefined) ?? null);
    setLanding(null);
    setDropMode("return");
    dir.current = 0;
    liftScale.set(1);
    liftRotate.set(0);
    animate(liftScale, LIFT.scale, reduce ? INSTANT : SPRING);
  };

  const onDragMove = (e: DragMoveEvent) => {
    /* Eğim sürükleme yönüne göre: sağa → +1.5°, sola → -1.5° */
    const d = Math.sign(e.delta.x);
    if (d !== 0 && d !== dir.current) {
      dir.current = d;
      animate(liftRotate, d * LIFT.rotate, reduce ? INSTANT : SPRING);
    }
    /* Kenara yaklaşınca pano kendiliğinden kayar */
    const vp = viewRef.current;
    const r = e.active.rect.current.translated;
    if (!vp || !r || !pan) return;
    const box = vp.getBoundingClientRect();
    const edge = 56;
    if (r.right > box.right - edge) x.set(clamp(x.get() - 14, bounds.left, 0));
    else if (r.left < box.left + edge) x.set(clamp(x.get() + 14, bounds.left, 0));
  };

  const settleLift = () => {
    const t = reduce ? INSTANT : SPRING;
    animate(liftScale, 1, t);
    animate(liftRotate, 0, t);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const task = e.active.data.current?.task as Task | undefined;
    const lane = lanes.find((l) => l.id === e.over?.id);
    const r = e.active.rect.current.translated;
    if (!task || !lane?.drop || lane.tasks.some((t) => t.id === task.id) || !r) {
      settleLift();
      return;
    }
    // Aynı işlem içinde: DragOverlay geri dönüş animasyonunu çalıştırmaz, kart yeni yerinde bırakıldığı noktadan iner
    setDropMode("land");
    setLanding({ id: task.id, left: r.left, top: r.top, scale: liftScale.get(), rotate: liftRotate.get() });
    onDrop(task, lane.drop);
  };

  /*
   * Bırakılan ya da yeni eklenen kartın raptiyesi bir kez saplanır.
   * İyimser ekleme önce "temp-…" kimliğiyle gelir; sunucu gerçek kimliği verince kart
   * yeniden doğmuş sayılmaz (quiet: giriş animasyonu ve ikinci sekme yok).
   * Süzgeç ya da odak değişince yeniden görünen kartlar da yeni sayılmaz (seen).
   */
  const seen = useRef<Set<string> | null>(null);
  const prevVisible = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const [quiet, setQuiet] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const ids = new Set(lanes.flatMap((l) => l.tasks.map((t) => t.id)));
    const before = seen.current;
    seen.current = new Set([...(before ?? []), ...ids]);
    const vanishedTemp = [...prevVisible.current].some((id) => id.startsWith("temp-") && !ids.has(id));
    prevVisible.current = ids;
    if (!before) return;
    const added = [...ids].filter((id) => !before.has(id));
    if (!added.length) return;
    if (vanishedTemp) {
      setQuiet(new Set(added.filter((id) => !id.startsWith("temp-"))));
      setFresh(new Set(added.filter((id) => id.startsWith("temp-"))));
    } else setFresh(new Set(added));
  }, [lanes]);
  useEffect(() => {
    if (!landed && fresh.size === 0 && quiet.size === 0) return;
    const t = window.setTimeout(() => {
      setLanding(null);
      setFresh(new Set());
      setQuiet(new Set());
    }, 900);
    return () => window.clearTimeout(t);
  }, [landed, fresh, quiet]);

  /* İlk yüklemede kartlar canlandırılmaz; sonradan gelenler (odak, süzgeç, ekleme) yaylanarak girer */
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  /* Telefon: görünen şerit → alttaki noktalar */
  const [current, setCurrent] = useState(0);
  const onScroll = () => {
    onNativeScroll();
    const vp = viewRef.current;
    if (!vp || pan) return;
    const first = vp.querySelector<HTMLElement>(".lane");
    const w = first ? first.offsetWidth + 16 : 1;
    setCurrent(Math.round(vp.scrollLeft / w));
  };

  return (
    <section id="pano" className={`board ${panning ? "is-panning" : ""}`} aria-label="Pano">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          settleLift();
          setActive(null);
        }}
      >
        <div
          ref={viewRef}
          className="board__view"
          onScroll={onScroll}
          onPointerDown={(e) => {
            if (!pan || e.button !== 0 || (e.target as HTMLElement).closest(NO_PAN)) return;
            controls.start(e);
          }}
        >
          <motion.div
            ref={contentRef}
            className="board__lanes"
            style={pan ? { x, y } : undefined}
            drag={pan}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ left: bounds.left, right: 0, top: bounds.top, bottom: 0 }}
            dragElastic={EDGE_ELASTIC}
            dragMomentum={!reduce}
            dragTransition={INERTIA}
            onDragStart={() => setPanning(true)}
            onDragEnd={() => setPanning(false)}
          >
            <AnimatePresence mode="popLayout" initial={false} propagate>
              {lanes.map((lane, i) => (
                <LaneView
                  key={lane.id}
                  lane={lane}
                  tilt={LANE_TILTS[i % LANE_TILTS.length]}
                  schema={schema}
                  showNotes={showNotes}
                  landing={landing}
                  fresh={fresh}
                  quiet={quiet}
                  animateIn={settled}
                  reduce={reduce}
                  onOpen={onOpen}
                  onToggleDone={onToggleDone}
                  onQuickAdd={onQuickAdd}
                  onNewWithDraft={onNewWithDraft}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
        {empty && <p className="board__empty">{empty}</p>}
        {createPortal(
          <DragOverlay dropAnimation={dropMode === "land" ? null : dropAnimation} zIndex={60}>
            {active ? <LiftedCard task={active} schema={schema} showNote={showNotes} scale={liftScale} rotate={liftRotate} /> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
      <span className="board__hint" aria-hidden>
        SÜRÜKLE · KAYDIR
      </span>
      <span className="board__dots" aria-hidden>
        {lanes.map((l, i) => (
          <i key={l.id} className={i === current ? "is-on" : undefined} />
        ))}
      </span>
    </section>
  );
}

/** Tutulan kart: ölçek ve eğim MotionValue'dan gelir (bırakma animasyonu sırasında da yaylanır) */
function LiftedCard({ task, schema, showNote, scale, rotate }: { task: Task; schema: Schema; showNote: boolean; scale: MotionValue<number>; rotate: MotionValue<number> }) {
  return (
    <motion.div className="card-lift" style={{ scale, rotate }}>
      <TaskCard task={task} schema={schema} showNote={showNote} onOpen={() => {}} onToggleDone={() => {}} dragging />
    </motion.div>
  );
}

/** Ref'i hem dnd-kit'e hem AnimatePresence'a (popLayout ölçümü) bağlar */
function useMergedRef<T>(...refs: (Ref<T> | ((el: T | null) => void) | undefined)[]) {
  return useCallback(
    (el: T | null) => {
      for (const r of refs) {
        if (typeof r === "function") r(el);
        else if (r && typeof r === "object") (r as { current: T | null }).current = el;
      }
    },
    // ref'ler kararlıdır; dizinin kendisi her çağrıda yenidir
    refs,
  );
}

interface LaneProps {
  /** React 19: ref sıradan bir prop; AnimatePresence popLayout çıkan şeridi ölçmek için verir */
  ref?: Ref<HTMLElement>;
  lane: Lane;
  tilt: number;
  schema: Schema;
  showNotes: boolean;
  landing: Landing | null;
  fresh: ReadonlySet<string>;
  quiet: ReadonlySet<string>;
  /** false: ilk yükleme (giriş animasyonu yok) */
  animateIn: boolean;
  reduce: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onQuickAdd: (title: string, patch: TaskPatch) => void;
  onNewWithDraft: (draft: TaskPatch & { title?: string }) => void;
}

const LaneView = memo(function LaneView({ ref, lane, tilt, schema, showNotes, landing, fresh, quiet, animateIn, reduce, onOpen, onToggleDone, onQuickAdd, onNewWithDraft }: LaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.id, disabled: !lane.drop });
  const sectionRef = useMergedRef<HTMLElement>(ref, setNodeRef);
  const t = reduce ? INSTANT : SPRING;
  const landed = landing?.id ?? null;
  const enterFrom = animateIn ? { opacity: 0, y: -6, scale: 0.96 } : false;
  return (
    /*
     * Şeridin kendisi sönmez: odak değişince içindeki kartlar layoutId ile yeni şeride kayar.
     * Çıkan şerit (ve onunla giden kartlar) söner; yeni şeridin başlığı ve boş durumu yaylanarak belirir.
     */
    <motion.section
      ref={sectionRef}
      layout="position"
      exit={{ opacity: 0, scale: 0.96 }}
      transition={t}
      className={`lane ${isOver ? "is-over" : ""}`}
      data-tone={lane.tone}
      aria-label={lane.sub ? `${lane.title} · ${lane.sub}` : lane.title}
      style={{ "--lane-c": lane.color, "--lane-tilt": `${tilt}deg` } as React.CSSProperties}
    >
      <motion.header className="lane__label" initial={enterFrom} animate={{ opacity: 1, y: 0, scale: 1 }} transition={t}>
        <i className="lane__dot" aria-hidden />
        <h2 className="lane__title">{lane.title}</h2>
        {lane.sub && <span className="lane__sub">{lane.sub}</span>}
        <span className="lane__count" aria-label={`${lane.tasks.length} kart`}>
          {lane.tasks.length}
        </span>
        {lane.totalMinutes > 0 && <span className="lane__min">{formatDuration(lane.totalMinutes)}</span>}
      </motion.header>
      <div className="lane__cards">
        <AnimatePresence mode="popLayout" initial={animateIn}>
          {lane.tasks.map((task) => (
            <DraggableCard
              key={task.id}
              task={task}
              schema={schema}
              showNote={showNotes}
              pop={landed === task.id || fresh.has(task.id)}
              // Bırakılan kart dnd-kit'in yay animasyonuyla iner; ikinci bir layout animasyonu karışmasın
              shared={landed !== task.id}
              landing={landing?.id === task.id ? landing : null}
              enter={!quiet.has(task.id) && landed !== task.id}
              reduce={reduce}
              onOpen={onOpen}
              onToggleDone={onToggleDone}
            />
          ))}
        </AnimatePresence>
        {lane.tasks.length === 0 && (
          <motion.div className="lane__empty" initial={enterFrom} animate={{ opacity: 1, y: 0, scale: 1 }} transition={t}>
            {lane.empty}
          </motion.div>
        )}
      </div>
      {lane.add && <QuickAdd label="Kart ekle" onAdd={(title) => onQuickAdd(title, lane.add!)} onMore={(title) => onNewWithDraft({ ...lane.add, title })} />}
    </motion.section>
  );
});

function DraggableCard({
  ref,
  task,
  schema,
  showNote,
  pop,
  shared,
  landing,
  enter,
  reduce,
  onOpen,
  onToggleDone,
}: {
  ref?: Ref<HTMLDivElement>;
  task: Task;
  schema: Schema;
  showNote: boolean;
  pop: boolean;
  shared: boolean;
  landing: Landing | null;
  enter: boolean;
  reduce: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
}) {
  // Yalnızca işaretçi dinleyicileri: kartın kendisi zaten odaklanabilir bir düğme (article role=button)
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: task.id, data: { task } });
  const node = useRef<HTMLDivElement | null>(null);
  const slotRef = useMergedRef<HTMLDivElement>(ref, setNodeRef, node);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useMotionValue(0);
  const lift = useMotionValue(1);

  /* İniş: bırakıldığı noktadan (ölçekli ve eğik) yeni yerine yay 380/30/0.8 ile */
  useLayoutEffect(() => {
    const el = node.current;
    if (!landing || !el) return;
    const r = el.getBoundingClientRect();
    x.set(landing.left - r.left);
    y.set(landing.top - r.top);
    lift.set(landing.scale);
    rotate.set(landing.rotate);
    const t = reduce ? INSTANT : SPRING;
    const anims = [animate(x, 0, t), animate(y, 0, t), animate(lift, 1, t), animate(rotate, 0, t)];
    return () => anims.forEach((a) => a.stop());
    // yalnızca yeni bir iniş başladığında
  }, [landing, reduce, x, y, lift, rotate]);

  return (
    <motion.div
      ref={slotRef}
      {...listeners}
      style={{ x, y, rotate, scale: lift, zIndex: landing ? 5 : undefined }}
      layoutId={shared ? `card-${task.id}` : undefined}
      layout={shared ? true : undefined}
      initial={enter ? { opacity: 0, scale: 0.96 } : false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={reduce ? INSTANT : SPRING}
      className={`card-slot ${isDragging ? "is-ghost" : ""}`}
    >
      <TaskCard task={task} schema={schema} showNote={showNote} onOpen={onOpen} onToggleDone={onToggleDone} pop={pop && !reduce} />
    </motion.div>
  );
}
