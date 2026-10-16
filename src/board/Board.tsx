import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type Ref, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type ClientRect,
  type DragCancelEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import type { Schema, Task, TaskPatch } from "@shared/types";
import { TaskCard } from "@/components/TaskCard";
import { QuickAdd } from "@/components/QuickAdd";
import { PHONE, useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDuration } from "@/lib/format";
import { EDGE_ELASTIC, INERTIA, INSTANT, LIFT, SPRING } from "@/lib/physics";
import { stableKey } from "@/lib/stableKey";
import type { Lane } from "./layouts";
import "./Board.css";

interface Props {
  lanes: Lane[];
  /** Tüm kartlar (yalnızca görünenler değil): "yeni eklendi" kararı buradan verilir */
  tasks: Task[];
  schema: Schema;
  showNotes: boolean;
  empty: string | null;
  /** Odak anahtarı (Hafta'da haftayla birlikte): değişince pano başa ya da `anchor` şeridine kayar */
  focusKey: string;
  /** Odak değişince görünür kılınacak şeridin kimliği (ör. bugünün ya da takvimde seçilen günün şeridi) */
  anchor: string | null;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  /** Kart başka şeride bırakıldı; gerçekten bir değişiklik yapıldıysa true */
  onDrop: (t: Task, patch: TaskPatch) => boolean;
  onQuickAdd: (title: string, patch: TaskPatch) => void;
  onNewWithDraft: (draft: TaskPatch & { title?: string }) => void;
}

const LANE_TILTS = [-0.7, 0.5, -0.4, 0.6, -0.5, 0.4, -0.6, 0.5];
/** Panı başlatmayan öğeler: kartlar ve kontroller (pan yalnızca boş pano yüzeyinde başlar) */
const NO_PAN = ".card, .card-slot, button, input, textarea, select, a, label, .quickadd, .lane__label";
/** Tutulan kartın panodaki yer tutucusu bu saydamlıkta kalır */
const GHOST_OPACITY = 0.35;
/** Kenar oto-kaydırması: kenara bu kadar yaklaşınca, kare başına bu kadar piksel */
const EDGE_ZONE = 56;
const EDGE_STEP = 9;
/** Klavyeyle odaklanan öğe görünüm kenarına bu kadar yaklaşırsa pano kayar */
const FOCUS_MARGIN = 24;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Bounds {
  left: number;
  top: number;
}

/**
 * Bırakılan kart: bırakıldığı yer, ölçek ve eğimle şeridine iner — başka şeride bırakıldıysa yeni yerine, iptal ya da
 * aynı şerit ise eski yerine. dnd-kit'in geri dönüş animasyonu kullanılmaz: kaynak kart görünüm dışındayken
 * scrollIntoView ile panoyu tek karede sıçratıyor, pano kayarken de eskimiş bir hedefe uçuyordu.
 */
interface Landing {
  id: string;
  /** İnişin oynadığı şerit; başka şeride taşınıyorsa kaynak şeritteki eski kopya o arada bırakıldığı yerde bekler */
  lane: string;
  /** Başka şeride taşındı (yeni bir düğüm olarak iner) */
  cross: boolean;
  left: number;
  top: number;
  scale: number;
  rotate: number;
  /** Kart tutulurken odaktaydı: eski kopya kalkınca odak yeni yerindeki karta geçer */
  refocus: boolean;
  /** İnen kart ölçülünce (yer değiştirmeden önceki dikdörtgeniyle) çağrılır: pano kartı görünür kılacak kadar, aynı yayla kayar */
  settle: (el: HTMLElement | null, rect?: DOMRect) => void;
}

/**
 * Tek mantar pano. Masaüstünde boş yüzeyden sürükleyerek kaydırılır (Motion drag + inertia, kenarda direnç);
 * telefonda şeritler yatay scroll-snap ile kayar. Odak/süzgeç değişince kartlar layout yayıyla yeni şeride geçer,
 * çıkanlar söner. Kartlar dnd-kit ile tutulur: yükselir, eğilir; bırakılınca yerine yaylanır, raptiye saplanır.
 */
export function Board({ lanes, tasks, schema, showNotes, empty, focusKey, anchor, onOpen, onToggleDone, onDrop, onQuickAdd, onNewWithDraft }: Props) {
  const phone = useMediaQuery(PHONE);
  const reduce = Boolean(useReducedMotion());
  const viewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const controls = useDragControls();
  const [bounds, setBounds] = useState<Bounds>({ left: 0, top: 0 });
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const [panning, setPanning] = useState(false);
  const pan = !phone;

  /*
   * Panonun gitmekte olduğu yer. Bir yay sürerken yeni bir hedef (sınır daralması, klavye odağı) hesaplanacaksa
   * o anki ara değerden değil bu hedeften hesaplanır; böylece iki animasyon birbirini ezmez.
   */
  const goal = useRef<{ x: number; y: number } | null>(null);
  const panTo = useCallback(
    (nx: number, ny: number, instant = false) => {
      if (reduce || instant) {
        goal.current = null;
        x.jump(nx);
        y.jump(ny);
        return;
      }
      goal.current = { x: nx, y: ny };
      const a = animate(x, nx, SPRING);
      animate(y, ny, SPRING);
      void a.then(() => {
        if (goal.current?.x === nx && goal.current?.y === ny) goal.current = null;
      });
    },
    [reduce, x, y],
  );
  const current = useCallback(() => goal.current ?? { x: x.get(), y: y.get() }, [x, y]);

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

  /* Sınır daralırsa (ör. daha az şerit) pano yaylanarak içeri döner — gidilen hedef sınır içindeyse dokunulmaz */
  useEffect(() => {
    if (!pan) {
      goal.current = null;
      x.set(0);
      y.set(0);
      return;
    }
    const c = current();
    const nx = clamp(c.x, bounds.left, 0);
    const ny = clamp(c.y, bounds.top, 0);
    if (nx !== c.x || ny !== c.y) panTo(nx, ny);
  }, [bounds, pan, current, panTo, x, y]);

  /* Odak (ya da Hafta'da hafta / seçilen gün) değişti: başa ya da `anchor` şeridine kay */
  useEffect(() => {
    const vp = viewRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    // Kimlikle aranır: popLayout'ta sönmekte olan eski şeritler (ör. Bugün odağının "Bugün"ü) hâlâ DOM'dadır
    const lane = anchor ? ct.querySelector<HTMLElement>(`.lane[data-lane="${CSS.escape(anchor)}"]`) : null;
    if (pan) {
      const target = lane ? Math.max(0, lane.offsetLeft - 32) : 0;
      panTo(clamp(-target, Math.min(0, vp.clientWidth - ct.offsetWidth), 0), 0);
    } else {
      vp.scrollTo({ left: lane ? Math.max(0, lane.offsetLeft - 16) : 0, behavior: reduce ? "auto" : "smooth" });
    }
    // yalnızca odak/hedef değişiminde çalışır (diğer değerler o anki hâlleriyle okunur)
  }, [focusKey, anchor]);

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
      goal.current = null;
      x.stop();
      y.stop();
      x.set(clamp(x.get() - dx, bounds.left, 0));
      y.set(clamp(y.get() - dy, bounds.top, 0));
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [pan, bounds, x, y]);

  /* Tarayıcının yerel kaydırması (ör. odaklanan öğeyi göstermek için) pana çevrilir; görünüm yerinde kalır */
  const absorbScroll = useCallback(() => {
    const vp = viewRef.current;
    if (!vp || !pan || (vp.scrollLeft === 0 && vp.scrollTop === 0)) return;
    const c = current();
    const sl = vp.scrollLeft;
    const st = vp.scrollTop;
    vp.scrollLeft = 0;
    vp.scrollTop = 0;
    panTo(clamp(c.x - sl, bounds.left, 0), clamp(c.y - st, bounds.top, 0), true);
  }, [pan, bounds, current, panTo]);

  /** Masaüstü: öğe (ya da verilen dikdörtgen) görünüm dışındaysa pano onu görünür kılacak kadar yayla kayar */
  const reveal = useCallback(
    (el: HTMLElement, rect?: DOMRect) => {
      const vp = viewRef.current;
      if (!vp || !pan) return;
      absorbScroll();
      const c = current();
      const box = vp.getBoundingClientRect();
      const r = rect ?? el.getBoundingClientRect();
      // öğenin konumu o anki (belki yay ortasındaki) değere göre ölçüldü → hedef koordinatına çevir
      const ox = c.x - x.get();
      const oy = c.y - y.get();
      let dx = 0;
      let dy = 0;
      if (r.right + ox > box.right - FOCUS_MARGIN) dx = box.right - FOCUS_MARGIN - (r.right + ox);
      if (r.left + ox + dx < box.left + FOCUS_MARGIN) dx = box.left + FOCUS_MARGIN - (r.left + ox);
      if (r.bottom + oy > box.bottom - FOCUS_MARGIN) dy = box.bottom - FOCUS_MARGIN - (r.bottom + oy);
      if (r.top + oy + dy < box.top + FOCUS_MARGIN) dy = box.top + FOCUS_MARGIN - (r.top + oy);
      if (dx || dy) panTo(clamp(c.x + dx, bounds.left, 0), clamp(c.y + dy, bounds.top, 0));
    },
    [pan, bounds, absorbScroll, current, panTo, x, y],
  );

  /* Klavyeyle odaklanan öğe görünüm dışındaysa (sol ya da sağ, üst ya da alt) pano onu görünür kılacak kadar kayar */
  useEffect(() => {
    const vp = viewRef.current;
    if (!vp || !pan) return;
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      // Fareyle tıklanan kart panoyu oynatmaz (tutup sürüklemeye başlarken kaymasın); yalnızca klavye odağı.
      // İnmekte olan kart atlanır: konumu henüz yolda (dönüşümlü), hizalamayı inişin kendisi yapar.
      if (!el.matches(":focus-visible") || el.closest("[data-landing]")) return;
      requestAnimationFrame(() => reveal(el));
    };
    vp.addEventListener("focusin", onFocus);
    return () => vp.removeEventListener("focusin", onFocus);
  }, [pan, reveal]);

  /* ----------------------------------------------------------- Sürükle-bırak */
  const [active, setActive] = useState<Task | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  /* Telefon: tutulurken ve bırakınca şerit hizalanana kadar scroll-snap kapalı (anında yeniden yapışma sıçratıyordu) */
  const [free, setFree] = useState(false);
  const scrollAnim = useRef<AnimationPlaybackControls | null>(null);
  const liftScale = useMotionValue(1);
  const liftRotate = useMotionValue(0);
  const dir = useRef(0);
  const edge = useRef(0);
  const edgeLoop = useRef(0);
  const remeasure = useRef<(() => void) | null>(null);
  /* Son bilinen tutma dikdörtgeni: Esc ile iptalde dnd-kit translated'ı boş verebiliyor */
  const lastRect = useRef<ClientRect | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  /* Pano transform ile kaydığından dnd-kit'in bırakma alanı ölçüleri eskir: kaydıkça yeniden ölçtür */
  useEffect(() => {
    if (!active || !pan) return;
    let queued = false;
    return x.on("change", () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        remeasure.current?.();
      });
    });
  }, [active, pan, x]);

  const stopEdgeLoop = () => {
    edge.current = 0;
    cancelAnimationFrame(edgeLoop.current);
    edgeLoop.current = 0;
  };
  useEffect(() => stopEdgeLoop, []);

  /*
   * Bırakınca: inen kartın şeridi görünür olsun. Telefonda pano o şeride (kart yoksa en yakın şeride) hizalanır,
   * yapışma ancak sonra döner; masaüstünde kart görünüm dışındaysa pano kayar. Kaydırma, inişle AYNI anda ve AYNI
   * yayla oynar: inişin başlangıç farkı kaydırmadan önce ölçüldüğü için kart ekranda tek bir yay çizer.
   */
  const settleView = (el: HTMLElement | null, rect?: DOMRect) => {
    const vp = viewRef.current;
    if (!vp) return setFree(false);
    if (pan) {
      if (el) reveal(el, rect);
      return setFree(false);
    }
    const max = vp.scrollWidth - vp.clientWidth;
    const laneEl = el?.closest<HTMLElement>(".lane");
    let target: number | undefined;
    if (laneEl) target = clamp(laneEl.offsetLeft - 16, 0, max);
    else {
      const stops = [...vp.querySelectorAll<HTMLElement>(".board__lanes > .lane:not([data-motion-pop-id])")].map((l) => clamp(l.offsetLeft - 16, 0, max));
      target = stops.reduce<number | undefined>((a, b) => (a === undefined || Math.abs(b - vp.scrollLeft) < Math.abs(a - vp.scrollLeft) ? b : a), undefined);
    }
    scrollAnim.current?.stop();
    if (target === undefined || Math.abs(target - vp.scrollLeft) < 1 || reduce) {
      if (target !== undefined) vp.scrollLeft = target;
      return setFree(false);
    }
    scrollAnim.current = animate(vp.scrollLeft, target, {
      ...SPRING,
      onUpdate: (v) => {
        vp.scrollLeft = v;
      },
      onComplete: () => setFree(false),
    });
  };
  /** Bir inişe bağlı, bir kez çalışan hizalama; kart hiç ölçülmezse (ör. süzgeç dışında kaldı) kısa süre sonra yine çalışır */
  const makeSettle = (): Landing["settle"] => {
    let done = false;
    const run = (el: HTMLElement | null, rect?: DOMRect) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      settleView(el, rect);
    };
    const timer = window.setTimeout(() => run(null), 400);
    return run;
  };

  const onDragStart = (e: DragStartEvent) => {
    setActive((e.active.data.current?.task as Task | undefined) ?? null);
    lastRect.current = e.active.rect.current.initial;
    scrollAnim.current?.stop();
    setFree(true);
    setLanding(null);
    dir.current = 0;
    liftScale.jump(1);
    liftRotate.jump(0);
    animate(liftScale, LIFT.scale, reduce ? INSTANT : SPRING);
    /* Kart kenarda beklerken de pano kaymaya devam etsin (işaretçi kıpırdamasa bile) */
    if (pan) {
      const tick = () => {
        if (edge.current) {
          const b = boundsRef.current;
          const nx = clamp(x.get() - edge.current * EDGE_STEP, b.left, 0);
          if (nx !== x.get()) {
            goal.current = null;
            x.set(nx);
          }
        }
        edgeLoop.current = requestAnimationFrame(tick);
      };
      edgeLoop.current = requestAnimationFrame(tick);
    }
  };

  const onDragMove = (e: DragMoveEvent) => {
    /* Eğim sürükleme yönüne göre: sağa → +1.5°, sola → -1.5° */
    const d = Math.sign(e.delta.x);
    if (d !== 0 && d !== dir.current) {
      dir.current = d;
      animate(liftRotate, d * LIFT.rotate, reduce ? INSTANT : SPRING);
    }
    /* Kenara yaklaşınca pano kendiliğinden kayar (sürekli döngü onDragStart'ta) */
    const vp = viewRef.current;
    const r = e.active.rect.current.translated;
    if (r) lastRect.current = r;
    if (!vp || !r || !pan) return;
    const box = vp.getBoundingClientRect();
    edge.current = r.right > box.right - EDGE_ZONE ? 1 : r.left < box.left + EDGE_ZONE ? -1 : 0;
  };

  /**
   * Bırakma: başka şeride geçtiyse orada, değilse (iptal, aynı şerit, bırakılamaz şerit, şerit dışı) kendi şeridinde
   * kart bırakıldığı noktadan iner. Tutulan kopya (DragOverlay) aynı karede kalkar; araya boş kare girmez.
   */
  const drop = (task: Task | undefined, rect: ClientRect | null, lane?: Lane) => {
    stopEdgeLoop();
    setActive(null);
    const r = rect ?? lastRect.current;
    lastRect.current = null;
    const cross = Boolean(task && lane?.drop && !lane.tasks.some((t) => t.id === task.id) && r && onDrop(task, lane.drop));
    const home = cross ? lane : lanes.find((l) => l.tasks.some((t) => t.id === task?.id));
    if (!task || !r || !home) {
      liftScale.jump(1);
      liftRotate.jump(0);
      settleView(null);
      return;
    }
    const refocus = Boolean((document.activeElement as HTMLElement | null)?.closest(`[data-card="${CSS.escape(task.id)}"]`));
    setLanding({ id: task.id, lane: home.id, cross, left: r.left, top: r.top, scale: liftScale.get(), rotate: liftRotate.get(), refocus, settle: makeSettle() });
  };
  const onDragEnd = (e: DragEndEvent) =>
    drop(
      e.active.data.current?.task as Task | undefined,
      e.active.rect.current.translated,
      lanes.find((l) => l.id === e.over?.id),
    );
  const onDragCancel = (e: DragCancelEvent) => drop(e.active.data.current?.task as Task | undefined, e.active.rect.current.translated);

  /*
   * Yeni eklenen kartın raptiyesi bir kez saplanır. "Yeni", görünür kartlara göre değil tüm kartlara göre
   * belirlenir: süzgeç, arama ya da hafta değişince ilk kez görünen eski kartlar sekmez. Anahtar kararlıdır
   * (stableKey): iyimser "temp-…" kimliği gerçeğiyle değişince kart yeniden doğmuş sayılmaz.
   */
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const keys = tasks.map((t) => stableKey(t.id));
    const before = seen.current;
    seen.current = new Set([...(before ?? []), ...keys]);
    if (!before) return;
    const added = keys.filter((k) => !before.has(k));
    if (added.length) setFresh(new Set(added));
  }, [tasks]);
  useEffect(() => {
    if (!landing && fresh.size === 0) return;
    const t = window.setTimeout(() => {
      setLanding(null);
      setFresh(new Set());
    }, 900);
    return () => window.clearTimeout(t);
  }, [landing, fresh]);

  /* İlk yüklemede kartlar canlandırılmaz; sonradan gelenler (odak, süzgeç, ekleme) yaylanarak girer */
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  /* Telefon: görünen şerit → alttaki noktalar */
  const [shownLane, setShownLane] = useState(0);
  const onScroll = () => {
    absorbScroll();
    const vp = viewRef.current;
    if (!vp || pan) return;
    const first = vp.querySelector<HTMLElement>(".lane");
    const w = first ? first.offsetWidth + 16 : 1;
    setShownLane(Math.round(vp.scrollLeft / w));
  };

  return (
    <section id="pano" className={`board ${panning ? "is-panning" : ""} ${free ? "is-free" : ""}`} aria-label="Pano">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        // Telefonda kenar kaydırması yumuşak: şerit şerit atlamasın, komşu şeride bırakılabilsin
        autoScroll={{ threshold: { x: 0.12, y: 0.15 }, acceleration: 6 }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <DroppableMeasure api={remeasure} />
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
            onDragStart={() => {
              goal.current = null;
              setPanning(true);
            }}
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
                  landing={landing?.lane === lane.id ? landing : null}
                  hold={landing && landing.lane !== lane.id ? landing : null}
                  phone={phone}
                  fresh={fresh}
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
          <DragOverlay dropAnimation={null} zIndex={60}>
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
          <i key={l.id} className={i === shownLane ? "is-on" : undefined} />
        ))}
      </span>
    </section>
  );
}

/** dnd-kit'in bırakma alanlarını yeniden ölçme işlevini dışarı verir (yalnızca DndContext içinden erişilebilir) */
function DroppableMeasure({ api }: { api: RefObject<(() => void) | null> }) {
  const { measureDroppableContainers } = useDndContext();
  useEffect(() => {
    api.current = () => measureDroppableContainers([]);
    return () => {
      api.current = null;
    };
  }, [api, measureDroppableContainers]);
  return null;
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
  /** Bu şeride inen kart (yalnızca inişin şeridine verilir) */
  landing: Landing | null;
  /** Başka şeride taşınan kartın bu şeritteki eski kopyası: yenisi gelene kadar bırakıldığı yerde bekler */
  hold: Landing | null;
  /** Telefonda paylaşılan layoutId yok: kaydırıcı şeritler arası uçuşu zaten gizler, popLayout kaldırırken titretiyordu */
  phone: boolean;
  /** Yeni eklenen kartların kararlı anahtarları */
  fresh: ReadonlySet<string>;
  /** false: ilk yükleme (giriş animasyonu yok) */
  animateIn: boolean;
  reduce: boolean;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onQuickAdd: (title: string, patch: TaskPatch) => void;
  onNewWithDraft: (draft: TaskPatch & { title?: string }) => void;
}

const LaneView = memo(function LaneView({ ref, lane, tilt, schema, showNotes, landing, hold, phone, fresh, animateIn, reduce, onOpen, onToggleDone, onQuickAdd, onNewWithDraft }: LaneProps) {
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
      // animate hedefi şart: sönerken anahtarı geri gelen şerit (hızlı odak turu) çıkış değerlerinde görünmez kalıyordu
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={t}
      className={`lane ${isOver ? "is-over" : ""}`}
      data-lane={lane.id}
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
          {lane.tasks.map((task) => {
            const key = stableKey(task.id);
            return (
              <DraggableCard
                key={key}
                layoutKey={key}
                task={task}
                schema={schema}
                showNote={showNotes}
                pop={landed === task.id || fresh.has(key)}
                // Başka şeride inen kart kendi yayıyla iner; ikinci bir layout animasyonu karışmasın
                shared={!phone && !(landed === task.id && landing?.cross)}
                landing={landed === task.id ? landing : null}
                hold={hold?.id === task.id ? hold : null}
                enter={landed !== task.id}
                reduce={reduce}
                onOpen={onOpen}
                onToggleDone={onToggleDone}
              />
            );
          })}
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
  layoutKey,
  task,
  schema,
  showNote,
  pop,
  shared,
  landing,
  hold,
  enter,
  reduce,
  onOpen,
  onToggleDone,
}: {
  ref?: Ref<HTMLDivElement>;
  /** Kararlı anahtar (layoutId için) */
  layoutKey: string;
  task: Task;
  schema: Schema;
  showNote: boolean;
  pop: boolean;
  shared: boolean;
  landing: Landing | null;
  hold: Landing | null;
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
  /* Giriş sönmesi yaylı; sonraki saydamlık değişimleri (tutuldu, gizlendi, yerine oturdu) anında */
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  /* İniş: bırakıldığı noktadan (ölçekli ve eğik) yerine yay 380/30/0.8 ile; pano da aynı anda aynı yayla hizalanır */
  useLayoutEffect(() => {
    const el = node.current;
    if (!landing || !el) return;
    const r = el.getBoundingClientRect();
    // jump: iniş bırakıldığı yerde hızsız başlar (set'in sıçrama hızı yayı savururdu)
    x.jump(landing.left - r.left);
    y.jump(landing.top - r.top);
    lift.jump(landing.scale);
    rotate.jump(landing.rotate);
    const t = reduce ? INSTANT : SPRING;
    const anims = [animate(x, 0, t), animate(y, 0, t), animate(lift, 1, t), animate(rotate, 0, t)];
    if (landing.refocus) el.querySelector<HTMLElement>(".card")?.focus({ preventScroll: true });
    landing.settle(el, r);
    return () => anims.forEach((a) => a.stop());
    // yalnızca yeni bir iniş başladığında
  }, [landing, reduce, x, y, lift, rotate]);

  /*
   * Başka şeride taşınan kartın eski kopyası: iyimser güncelleme gelene kadar (bir-iki kare) bırakıldığı yerde durur,
   * gelince anında kalkar ve yenisi aynı noktadan iner — arada boş kare olmaz. Güncelleme gelmezse yerine yaylanır.
   */
  const held = useRef(false);
  useLayoutEffect(() => {
    const el = node.current;
    if (hold && el) {
      const r = el.getBoundingClientRect();
      x.jump(hold.left - r.left + x.get());
      y.jump(hold.top - r.top + y.get());
      lift.jump(hold.scale);
      rotate.jump(hold.rotate);
      held.current = true;
      return;
    }
    if (!hold && held.current) {
      held.current = false;
      const t = reduce ? INSTANT : SPRING;
      animate(x, 0, t);
      animate(y, 0, t);
      animate(lift, 1, t);
      animate(rotate, 0, t);
    }
  }, [hold, reduce, x, y, lift, rotate]);

  const t = reduce ? INSTANT : SPRING;
  return (
    <motion.div
      ref={slotRef}
      {...listeners}
      style={{ x, y, rotate, scale: lift, zIndex: landing || hold ? 5 : undefined }}
      layoutId={shared ? `card-${layoutKey}` : undefined}
      layout={shared ? true : undefined}
      initial={enter ? { opacity: 0, scale: 0.96 } : false}
      animate={{ opacity: isDragging ? GHOST_OPACITY : 1, scale: 1 }}
      // Bekleyen eski kopya yenisi gelince anında kalkar; diğerleri (odak, süzgeç) yayla söner
      exit={hold ? { opacity: 0, transition: INSTANT } : { opacity: 0, scale: 0.96, transition: t }}
      transition={{ ...t, opacity: mounted.current ? INSTANT : t }}
      className={`card-slot ${isDragging ? "is-ghost" : ""}`}
      data-card={task.id}
      data-landing={landing ? "" : undefined}
    >
      <TaskCard task={task} schema={schema} showNote={showNote} onOpen={onOpen} onToggleDone={onToggleDone} pop={pop && !reduce} />
    </motion.div>
  );
}
