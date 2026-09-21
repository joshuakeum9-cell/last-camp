import { bus, Subscriptions } from '../core/EventBus';
import { state } from '../core/GameState';

type CueFn = (ctx: AudioContext, out: GainNode, now: number, opts: CueOpts) => void;
interface CueOpts {
  volume: number;
  rate: number;
}

/**
 * Every sound in the game is synthesised here, so the build ships with no audio files
 * and nothing is licensed from anywhere. Each cue is a few oscillators and an envelope.
 *
 * A later pass can replace any cue with a recorded sample under the same name without
 * touching a single caller.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private windGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private subs = new Subscriptions();
  private lastPickupAt = 0;
  private pickupChain = 0;
  private started = false;

  constructor() {
    this.subs.add(bus.on('audio:play', (p) => this.play(p.cue, p.volume ?? 1, p.rate ?? 1)));
    this.subs.add(bus.on('audio:music', (p) => this.setMusic(p.cue)));
    this.subs.add(bus.on('settings:changed', () => this.applyVolumes()));

    // Browsers will not start audio until the player does something. Wait for that.
    const unlock = () => {
      this.ensureContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain.connect(this.ctx.destination);
      this.applyVolumes();
      this.started = true;
      this.startWind();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.sfxGain.gain.value = state.settings.sfx;
    this.musicGain.gain.value = state.settings.music;
  }

  // --- cues --------------------------------------------------------------

  play(cue: string, volume = 1, rate = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const fn = CUES[cue] ?? CUES[cue.split('-')[0]];
    if (!fn) return;

    // Consecutive pickups climb in pitch, which turns a good haul into a little tune.
    let finalRate = rate;
    if (cue === 'pickup') {
      const now = ctx.currentTime;
      this.pickupChain = now - this.lastPickupAt < 1 ? Math.min(12, this.pickupChain + 1) : 0;
      this.lastPickupAt = now;
      finalRate = rate * Math.pow(2, this.pickupChain / 12);
    }

    try {
      fn(ctx, this.sfxGain, ctx.currentTime, { volume, rate: finalRate });
    } catch {
      /* a dropped sound must never break the game */
    }
  }

  /** A low filtered-noise bed that follows the time of day. */
  private startWind(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const noise = makeNoise(ctx, 4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.03;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    noise.connect(filter).connect(gain).connect(this.musicGain);
    noise.start();
    this.windGain = gain;
  }

  setWindIntensity(t: number): void {
    if (!this.windGain || !this.ctx) return;
    this.windGain.gain.setTargetAtTime(0.025 + t * 0.06, this.ctx.currentTime, 0.6);
  }

  // --- music -------------------------------------------------------------

  private setMusic(cue: string | null): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (!cue) return;

    const pattern = cue === 'boss' ? BOSS_PATTERN : NIGHT_PATTERN;
    const beatMs = cue === 'boss' ? 545 : 900;
    let step = 0;
    const tick = () => {
      const note = pattern[step % pattern.length];
      step++;
      if (note <= 0) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cue === 'boss' ? 'sawtooth' : 'sine';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(cue === 'boss' ? 0.09 : 0.05, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + beatMs / 1000);
      osc.connect(gain).connect(this.musicGain);
      osc.start();
      osc.stop(ctx.currentTime + beatMs / 1000 + 0.05);
    };
    tick();
    this.musicTimer = window.setInterval(tick, beatMs);
  }

  get isRunning(): boolean {
    return this.started;
  }

  destroy(): void {
    this.subs.dispose();
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    void this.ctx?.close();
    this.ctx = null;
  }
}

// --- synthesis helpers ---------------------------------------------------

function makeNoise(ctx: AudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

function blip(
  ctx: AudioContext,
  out: GainNode,
  now: number,
  opts: { freq: number; to?: number; dur: number; type?: OscillatorType; gain: number; delay?: number },
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? 'square';
  const t = now + (opts.delay ?? 0);
  osc.frequency.setValueAtTime(opts.freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + opts.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + opts.dur + 0.03);
}

function thump(
  ctx: AudioContext,
  out: GainNode,
  now: number,
  opts: { dur: number; gain: number; cutoff: number },
): void {
  const src = makeNoise(ctx, 1);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(opts.cutoff, now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(60, opts.cutoff * 0.25), now + opts.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
  src.connect(filter).connect(g).connect(out);
  src.start(now);
  src.stop(now + opts.dur + 0.05);
}

/** A short bright noise burst that sweeps downward. Snow, impacts, breaking things. */
function crunch(
  ctx: AudioContext,
  out: GainNode,
  now: number,
  opts: { dur: number; gain: number; cutoff: number; sweep: number },
): void {
  const src = makeNoise(ctx, 1);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(opts.cutoff, now);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(120, opts.cutoff * opts.sweep),
    now + opts.dur,
  );
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
  src.connect(filter).connect(g).connect(out);
  src.start(now);
  src.stop(now + opts.dur + 0.05);
}

const NIGHT_PATTERN = [110, 0, 98, 0, 87, 0, 98, 0];
const BOSS_PATTERN = [73, 73, 87, 73, 98, 73, 87, 65];

const CUES: Record<string, CueFn> = {
  /** Snow underfoot: a short bright crunch over a soft body thump. */
  step: (c, o, n, p) => {
    crunch(c, o, n, { dur: 0.07, gain: 0.3 * p.volume, cutoff: 5200, sweep: 0.35 });
    thump(c, o, n, { dur: 0.09, gain: 0.16 * p.volume, cutoff: 700 });
  },
  dash: (c, o, n, p) => {
    thump(c, o, n, { dur: 0.16, gain: 0.12 * p.volume, cutoff: 2400 });
    blip(c, o, n, { freq: 620, to: 1500, dur: 0.12, type: 'sine', gain: 0.05 * p.volume });
  },
  perfect: (c, o, n, p) => {
    blip(c, o, n, { freq: 880, dur: 0.1, type: 'sine', gain: 0.1 * p.volume });
    blip(c, o, n, { freq: 1320, dur: 0.22, type: 'sine', gain: 0.1 * p.volume, delay: 0.07 });
  },
  swing: (c, o, n, p) => crunch(c, o, n, { dur: 0.11, gain: 0.16 * p.volume, cutoff: 3600, sweep: 0.4 }),
  swingHeavy: (c, o, n, p) => {
    thump(c, o, n, { dur: 0.18, gain: 0.13 * p.volume, cutoff: 2000 });
    blip(c, o, n, { freq: 180, to: 70, dur: 0.18, type: 'sine', gain: 0.1 * p.volume });
  },
  whiff: (c, o, n, p) => crunch(c, o, n, { dur: 0.09, gain: 0.1 * p.volume, cutoff: 4200, sweep: 0.5 }),
  /**
   * A landed hit is three layers: a bright transient so it reads instantly, a body
   * thump so it has weight, and a falling tone so it sounds like something took it.
   */
  hit: (c, o, n, p) => {
    crunch(c, o, n, { dur: 0.05, gain: 0.34 * p.volume, cutoff: 6000, sweep: 0.25 });
    thump(c, o, n, { dur: 0.13, gain: 0.34 * p.volume, cutoff: 1100 });
    blip(c, o, n, { freq: 240, to: 80, dur: 0.13, type: 'square', gain: 0.2 * p.volume });
  },
  critHit: (c, o, n, p) => {
    crunch(c, o, n, { dur: 0.06, gain: 0.4 * p.volume, cutoff: 7000, sweep: 0.2 });
    thump(c, o, n, { dur: 0.17, gain: 0.4 * p.volume, cutoff: 1500 });
    blip(c, o, n, { freq: 300, to: 70, dur: 0.16, type: 'square', gain: 0.22 * p.volume });
    blip(c, o, n, { freq: 880, dur: 0.07, type: 'square', gain: 0.2 * p.volume });
    blip(c, o, n, { freq: 1320, dur: 0.16, type: 'square', gain: 0.18 * p.volume, delay: 0.05 });
  },
  enemyDie: (c, o, n, p) => {
    blip(c, o, n, { freq: 420, to: 60, dur: 0.32, type: 'sawtooth', gain: 0.22 * p.volume });
    thump(c, o, n, { dur: 0.26, gain: 0.26 * p.volume, cutoff: 1100 });
    crunch(c, o, n, { dur: 0.1, gain: 0.2 * p.volume, cutoff: 3000, sweep: 0.3 });
  },
  playerHurt: (c, o, n, p) => {
    blip(c, o, n, { freq: 300, to: 110, dur: 0.26, type: 'sawtooth', gain: 0.3 * p.volume });
    thump(c, o, n, { dur: 0.18, gain: 0.22 * p.volume, cutoff: 800 });
  },
  pickup: (c, o, n, p) => blip(c, o, n, { freq: 660 * p.rate, to: 990 * p.rate, dur: 0.1, type: 'sine', gain: 0.08 * p.volume }),
  pickupRare: (c, o, n, p) => {
    for (const [i, f] of [660, 880, 1320].entries()) {
      blip(c, o, n, { freq: f, dur: 0.2, type: 'sine', gain: 0.09 * p.volume, delay: i * 0.06 });
    }
  },
  chop: (c, o, n, p) => {
    crunch(c, o, n, { dur: 0.05, gain: 0.26 * p.volume, cutoff: 4500, sweep: 0.3 });
    thump(c, o, n, { dur: 0.13, gain: 0.26 * p.volume, cutoff: 900 });
    blip(c, o, n, { freq: 170, to: 70, dur: 0.12, type: 'sine', gain: 0.16 * p.volume });
  },
  nodeBreak: (c, o, n, p) => {
    thump(c, o, n, { dur: 0.35, gain: 0.16 * p.volume, cutoff: 1500 });
  },
  smash: (c, o, n, p) => thump(c, o, n, { dur: 0.2, gain: 0.15 * p.volume, cutoff: 2600 }),
  cache: (c, o, n, p) => {
    for (const [i, f] of [523, 659, 784, 1046].entries()) {
      blip(c, o, n, { freq: f, dur: 0.26, type: 'triangle', gain: 0.08 * p.volume, delay: i * 0.07 });
    }
  },
  weaponFound: (c, o, n, p) => {
    for (const [i, f] of [392, 523, 659, 784, 1046].entries()) {
      blip(c, o, n, { freq: f, dur: 0.3, type: 'square', gain: 0.07 * p.volume, delay: i * 0.06 });
    }
  },
  upgrade: (c, o, n, p) => {
    for (const [i, f] of [262, 330, 392].entries()) {
      blip(c, o, n, { freq: f, dur: 0.4, type: 'triangle', gain: 0.07 * p.volume, delay: i * 0.02 });
    }
  },
  warm: (c, o, n, p) => blip(c, o, n, { freq: 196, to: 330, dur: 0.6, type: 'sine', gain: 0.07 * p.volume }),
  note: (c, o, n, p) => blip(c, o, n, { freq: 1200, to: 900, dur: 0.14, type: 'sine', gain: 0.05 * p.volume }),
  discover: (c, o, n, p) => {
    blip(c, o, n, { freq: 440, dur: 0.4, type: 'sine', gain: 0.07 * p.volume });
    blip(c, o, n, { freq: 660, dur: 0.5, type: 'sine', gain: 0.06 * p.volume, delay: 0.12 });
  },
  nightfall: (c, o, n, p) => blip(c, o, n, { freq: 220, to: 110, dur: 1.2, type: 'sine', gain: 0.08 * p.volume }),
  telegraph: (c, o, n, p) => blip(c, o, n, { freq: 140, to: 190, dur: 0.22, type: 'sawtooth', gain: 0.05 * p.volume }),
  spit: (c, o, n, p) => blip(c, o, n, { freq: 700, to: 300, dur: 0.14, type: 'square', gain: 0.06 * p.volume }),
  bow: (c, o, n, p) => blip(c, o, n, { freq: 900, to: 1600, dur: 0.12, type: 'triangle', gain: 0.07 * p.volume }),
  eat: (c, o, n, p) => {
    crunch(c, o, n, { dur: 0.09, gain: 0.22 * p.volume, cutoff: 2600, sweep: 0.4 });
    blip(c, o, n, { freq: 330, to: 440, dur: 0.18, type: 'sine', gain: 0.1 * p.volume, delay: 0.08 });
  },
  empty: (c, o, n, p) => blip(c, o, n, { freq: 200, dur: 0.06, type: 'square', gain: 0.04 * p.volume }),
  swap: (c, o, n, p) => blip(c, o, n, { freq: 520, to: 700, dur: 0.09, type: 'square', gain: 0.06 * p.volume }),
  gateOpen: (c, o, n, p) => {
    thump(c, o, n, { dur: 0.6, gain: 0.2 * p.volume, cutoff: 1800 });
    blip(c, o, n, { freq: 120, to: 60, dur: 0.6, type: 'sine', gain: 0.1 * p.volume });
  },
  lockedGate: (c, o, n, p) => blip(c, o, n, { freq: 90, dur: 0.5, type: 'sine', gain: 0.09 * p.volume }),
  rescue: (c, o, n, p) => {
    for (const [i, f] of [330, 440, 554, 659].entries()) {
      blip(c, o, n, { freq: f, dur: 0.5, type: 'triangle', gain: 0.07 * p.volume, delay: i * 0.1 });
    }
  },
  death: (c, o, n, p) => blip(c, o, n, { freq: 220, to: 55, dur: 1.4, type: 'sawtooth', gain: 0.12 * p.volume }),
  return: (c, o, n, p) => {
    for (const [i, f] of [392, 523, 659].entries()) {
      blip(c, o, n, { freq: f, dur: 0.6, type: 'sine', gain: 0.06 * p.volume, delay: i * 0.1 });
    }
  },
  maw: (c, o, n, p) => {
    blip(c, o, n, { freq: 90, to: 140, dur: 0.6, type: 'sawtooth', gain: 0.12 * p.volume });
  },
  mawCharge: (c, o, n, p) => thump(c, o, n, { dur: 0.5, gain: 0.2 * p.volume, cutoff: 900 }),
  mawSlam: (c, o, n, p) => {
    thump(c, o, n, { dur: 0.7, gain: 0.26 * p.volume, cutoff: 700 });
    blip(c, o, n, { freq: 70, to: 40, dur: 0.7, type: 'sine', gain: 0.14 * p.volume });
  },
  mawHowl: (c, o, n, p) => blip(c, o, n, { freq: 180, to: 420, dur: 0.9, type: 'sawtooth', gain: 0.12 * p.volume }),
  mawStun: (c, o, n, p) => thump(c, o, n, { dur: 0.9, gain: 0.24 * p.volume, cutoff: 1300 }),
  mawPhase2: (c, o, n, p) => blip(c, o, n, { freq: 60, to: 200, dur: 1.4, type: 'sawtooth', gain: 0.16 * p.volume }),
  mawDeath: (c, o, n, p) => {
    blip(c, o, n, { freq: 200, to: 40, dur: 2.2, type: 'sawtooth', gain: 0.16 * p.volume });
    thump(c, o, n, { dur: 1.6, gain: 0.2 * p.volume, cutoff: 800 });
  },
};

export const audio = new AudioManager();
