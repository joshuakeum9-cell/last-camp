import { bus, Subscriptions } from '../core/EventBus';
import { state } from '../core/GameState';

const KEY = 'lastcamp.analytics';
const MAX_EVENTS = 3000;

export interface AnalyticsEvent {
  t: number;
  day: number;
  name: string;
  props?: Record<string, unknown>;
}

/**
 * Local playtest instrumentation. Nothing is ever sent anywhere: the log lives in
 * localStorage and is exported by hand from the developer screen.
 *
 * It exists to answer the questions in PLAYTEST.md with numbers rather than memory.
 */
export class AnalyticsSystem {
  private events: AnalyticsEvent[] = [];
  private subs = new Subscriptions();
  private sessionStart = Date.now();
  private heartbeat: number | null = null;

  constructor() {
    this.load();
    this.track('session:start', { returning: this.events.length > 0 });

    this.subs.add(bus.on('day:started', ({ day }) => this.track('day:started', { day })));
    this.subs.add(
      bus.on('day:ended', ({ reason, day }) => this.track('day:ended', { reason, day })),
    );
    this.subs.add(bus.on('player:died', () => this.track('player:died', this.context())));
    this.subs.add(bus.on('camp:upgrade', ({ id }) => this.track('upgrade:bought', { id })));
    this.subs.add(bus.on('perk:bought', ({ id }) => this.track('perk:bought', { id })));
    this.subs.add(
      bus.on('weapon:found', ({ baseId, rarity }) => this.track('weapon:found', { baseId, rarity })),
    );
    this.subs.add(bus.on('cache:opened', ({ id, rarity }) => this.track('cache:opened', { id, rarity })));
    this.subs.add(bus.on('area:discovered', ({ areaId }) => this.track('area:discovered', { areaId })));
    this.subs.add(bus.on('secret:found', () => this.track('secret:found')));
    this.subs.add(bus.on('npc:rescued', ({ id }) => this.track('npc:rescued', { id })));
    this.subs.add(bus.on('boss:attempted', ({ id }) => this.track('boss:attempted', { id })));
    this.subs.add(bus.on('boss:defeated', ({ id }) => this.track('boss:defeated', { id })));
    this.subs.add(bus.on('player:dash', ({ perfect }) => {
      if (perfect) this.track('perfect_dodge', this.context());
    }));
    this.subs.add(bus.on('resource:collected', ({ id, amount, night }) => {
      if (night) this.track('night_bounty', { id, amount });
    }));
    this.subs.add(bus.on('shortcut:built', () => this.track('shortcut_built')));
    this.subs.add(bus.on('challenge:progress', ({ id, done }) => {
      if (done) this.track('challenge_completed', { id });
    }));
    this.subs.add(bus.on('achievement:unlocked', ({ id }) => this.track('achievement', { id })));
    this.subs.add(bus.on('store:opened', () => this.track('store:opened')));
    this.subs.add(bus.on('store:purchased', ({ itemId }) => this.track('store:purchased', { itemId })));
    this.subs.add(bus.on('ad:clicked', ({ rewardId }) => this.track('ad:clicked', { rewardId })));

    this.heartbeat = window.setInterval(() => this.track('heartbeat'), 60000);
    window.addEventListener('beforeunload', () => {
      this.track('session:end', { seconds: Math.round((Date.now() - this.sessionStart) / 1000) });
      this.save();
    });
  }

  private context(): Record<string, unknown> {
    return {
      day: state.day,
      phase: state.run?.phase ?? 'camp',
      campLevel: state.camp.level,
      hp: state.run?.hp,
    };
  }

  track(name: string, props?: Record<string, unknown>): void {
    this.events.push({ t: Date.now(), day: state.day, name, props });
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
    // Written on a delay rather than every event, so a busy fight does not thrash disk.
    this.scheduleSave();
  }

  private saveTimer: number | null = null;

  private scheduleSave(): void {
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 2000);
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.events = JSON.parse(raw) as AnalyticsEvent[];
    } catch {
      this.events = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.events));
    } catch {
      /* a full disk must never break the game */
    }
  }

  /** Counts per event name, for the developer screen. */
  summary(): Array<{ name: string; count: number }> {
    const counts = new Map<string, number>();
    for (const e of this.events) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  get sessionSeconds(): number {
    return Math.round((Date.now() - this.sessionStart) / 1000);
  }

  get count(): number {
    return this.events.length;
  }

  exportJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        sessionSeconds: this.sessionSeconds,
        totalEvents: this.events.length,
        summary: this.summary(),
        events: this.events,
      },
      null,
      2,
    );
  }

  clear(): void {
    this.events = [];
    this.save();
  }

  destroy(): void {
    this.subs.dispose();
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.save();
  }
}

export const analytics = new AnalyticsSystem();
