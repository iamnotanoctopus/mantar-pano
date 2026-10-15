/**
 * Hafif ses efektleri — Web Audio API ile sentezlenir, ses dosyası yoktur.
 *
 * Performans notları:
 *  - Tek bir AudioContext, ilk kullanıcı hareketinde (tıklama) tembelce açılır;
 *    tarayıcı autoplay politikası gereği askıdaysa resume() edilir.
 *  - Her ses birkaç osilatör + kazanç zarfından ibarettir; bittiğinde düğümler
 *    kendini kopartır (onended → disconnect), bellek birikmez.
 *  - Kazanç geçişleri rampalarla yapılır (ani sıçrama = tık/çıtırtı).
 */

export type SoundName = "pin" | "done" | "undo" | "delete" | "nudge" | "pop";

type Ctx = AudioContext;

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  freqEnd?: number;
  at?: number; // ctx.currentTime'a göre gecikme (sn)
  dur: number;
  gain?: number;
  attack?: number;
  release?: number;
  filter?: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number };
}

const EPS = 0.0001;

function tone(ctx: Ctx, out: AudioNode, o: ToneOpts) {
  const t0 = ctx.currentTime + (o.at ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(o.freqEnd, 1), t0 + o.dur);
  const peak = o.gain ?? 0.5;
  const attack = o.attack ?? 0.008;
  const release = o.release ?? Math.min(0.08, o.dur * 0.5);
  g.gain.setValueAtTime(EPS, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + Math.max(attack, o.dur - release));
  g.gain.exponentialRampToValueAtTime(EPS, t0 + o.dur);

  let last: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.freq, t0);
    if (o.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(o.filter.freqEnd, t0 + o.dur);
    if (o.filter.q) f.Q.value = o.filter.q;
    last.connect(f);
    last = f;
  }
  last.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
  return osc;
}

/** Kısa beyaz gürültü patlaması (iğne batma / tık sesi). */
function noise(ctx: Ctx, out: AudioNode, dur: number, gain: number, filterFreq: number, at = 0) {
  const t0 = ctx.currentTime + at;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = filterFreq;
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(EPS, t0 + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.01);
  src.onended = () => {
    src.disconnect();
    f.disconnect();
    g.disconnect();
  };
}

const SOUNDS: Record<SoundName, (ctx: Ctx, out: AudioNode) => void> = {
  /* Kart iğnelendi: tık + kısa tiz blip */
  pin(ctx, out) {
    noise(ctx, out, 0.045, 0.5, 2600);
    tone(ctx, out, { type: "sine", freq: 1100, freqEnd: 1700, dur: 0.07, gain: 0.25, at: 0.01 });
  },
  /* Tamamlandı: iki nota yukarı (A5 → D6) */
  done(ctx, out) {
    tone(ctx, out, { type: "sine", freq: 880, dur: 0.11, gain: 0.3 });
    tone(ctx, out, { type: "triangle", freq: 1174.66, dur: 0.16, gain: 0.26, at: 0.09, release: 0.1 });
  },
  /* Yeniden açıldı: iki nota aşağı */
  undo(ctx, out) {
    tone(ctx, out, { type: "sine", freq: 1174.66, dur: 0.1, gain: 0.22 });
    tone(ctx, out, { type: "sine", freq: 880, dur: 0.14, gain: 0.2, at: 0.08, release: 0.09 });
  },
  /* Silindi: alçalan hışırtı */
  delete(ctx, out) {
    tone(ctx, out, { type: "sawtooth", freq: 240, freqEnd: 70, dur: 0.19, gain: 0.22, filter: { type: "lowpass", freq: 1400, freqEnd: 260 } });
  },
  /* Küçük pop: sürükle-bırak ile alan değişti */
  pop(ctx, out) {
    tone(ctx, out, { type: "sine", freq: 520, freqEnd: 300, dur: 0.07, gain: 0.25 });
  },
  /* MSN dürtmesi: kare dalga + vibrato + tremolo */
  nudge(ctx, out) {
    const t0 = ctx.currentTime;
    const dur = 0.5;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc.type = "square";
    osc2.type = "square";
    osc.frequency.value = 118;
    osc2.frequency.value = 121.5; // hafif vuru
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = 26;
    vibGain.gain.value = 22;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);
    vibGain.connect(osc2.frequency);
    const trem = ctx.createOscillator();
    const tremGain = ctx.createGain();
    trem.frequency.value = 18;
    tremGain.gain.value = 0.35;
    const amp = ctx.createGain();
    amp.gain.value = 0.65;
    trem.connect(tremGain).connect(amp.gain);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    const env = ctx.createGain();
    env.gain.setValueAtTime(EPS, t0);
    env.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
    env.gain.setValueAtTime(0.28, t0 + dur - 0.08);
    env.gain.exponentialRampToValueAtTime(EPS, t0 + dur);
    osc.connect(lp);
    osc2.connect(lp);
    lp.connect(amp).connect(env).connect(out);
    for (const n of [osc, osc2, vib, trem]) {
      n.start(t0);
      n.stop(t0 + dur + 0.02);
    }
    osc.onended = () => {
      for (const n of [osc, osc2, vib, trem, vibGain, tremGain, amp, lp, env]) n.disconnect();
    };
    noise(ctx, out, 0.03, 0.4, 900);
  },
};

class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  enabled = true;
  volume = 0.22;

  get supported(): boolean {
    return typeof window !== "undefined" && ("AudioContext" in window || "webkitAudioContext" in window);
  }

  private ensure(): Ctx | null {
    if (!this.supported) return null;
    if (!this.ctx) {
      const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Kullanıcı hareketi içinde çağrılmalı (tıklama, tuş). */
  play(name: SoundName) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    try {
      SOUNDS[name](ctx, this.master);
    } catch {
      /* ses asla uygulamayı düşürmesin */
    }
  }
}

export const sounds = new SoundEngine();
