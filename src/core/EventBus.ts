import type { ResourceId, ConsumableId } from '../data/resources';
import type { Rarity } from '../art/palette';

/**
 * Typed pub/sub. Every cross-system message in the game goes through here, so a wrong
 * event name is a compile error rather than a silent no-op.
 *
 * Input is polled each frame by InputSystem, not evented.
 */
export interface GameEvents {
  'session:start': { day: number };

  'player:hit': { damage: number; source: string };
  'player:died': Record<string, never>;
  'player:dash': { perfect: boolean };
  'player:heal': { amount: number; source: string };
  'player:attack': { weaponId: string; charged: boolean };

  'enemy:hit': { id: string; type: string; damage: number; crit: boolean; kill: boolean };
  'enemy:killed': { id: string; type: string; x: number; y: number; night: boolean };

  'resource:collected': { id: ResourceId; amount: number; night: boolean };
  'node:broken': { kind: string };
  'breakable:broken': { kind: string };
  'cache:opened': { id: string; rarity: Rarity };
  'weapon:found': { instanceId: string; baseId: string; rarity: Rarity };
  'consumable:used': { id: ConsumableId };

  'area:discovered': { areaId: string };
  'secret:found': Record<string, never>;
  'shortcut:built': Record<string, never>;

  'day:started': { day: number };
  'day:phase': { phase: string };
  'day:ended': { reason: 'return' | 'death'; day: number };
  'cold:threshold': { level: 70 | 100 };

  'camp:upgrade': { id: string; level: number };
  'perk:bought': { id: string };
  'weapon:upgraded': { instanceId: string; branch: string };
  'camp:levelUp': { level: number };

  'npc:rescued': { id: string };
  'npc:assigned': { job: string };
  'offline:collected': { job: string; amount: number };

  'boss:attempted': { id: string };
  'boss:defeated': { id: string };

  'challenge:progress': { id: string; progress: number; done: boolean };
  'achievement:unlocked': { id: string };

  'store:opened': Record<string, never>;
  'store:purchased': { itemId: string };
  'ad:clicked': { rewardId: string };

  'juice:shake': { intensity: number; ms: number };
  'juice:hitstop': { ms: number };
  'juice:flash': { color?: number; ms?: number };
  'juice:toast': { text: string; color?: string; icon?: string };

  'audio:play': { cue: string; volume?: number; rate?: number };
  'audio:music': { cue: string | null };

  'settings:changed': { key: string };
  /** A hotbar slot was tapped or clicked: 0 and 1 are weapons, 2 is food. */
  'hud:slot': { slot: number };
}

export type EventName = keyof GameEvents;
type Handler<K extends EventName> = (payload: GameEvents[K]) => void;

class TypedEmitter {
  private handlers = new Map<EventName, Set<(p: never) => void>>();

  /** Subscribe. Returns an unsubscribe function; scenes collect these and call on shutdown. */
  on<K extends EventName>(name: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(fn as (p: never) => void);
    return () => this.off(name, fn);
  }

  /** Subscribe for exactly one firing. */
  once<K extends EventName>(name: K, fn: Handler<K>): () => void {
    const off = this.on(name, ((p: GameEvents[K]) => {
      off();
      fn(p);
    }) as Handler<K>);
    return off;
  }

  off<K extends EventName>(name: K, fn: Handler<K>): void {
    this.handlers.get(name)?.delete(fn as (p: never) => void);
  }

  emit<K extends EventName>(name: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(name);
    if (!set) return;
    // Copy so a handler that unsubscribes mid-emit does not corrupt the iteration.
    for (const fn of Array.from(set)) {
      try {
        (fn as Handler<K>)(payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${name}" threw:`, err);
      }
    }
  }

  /** Drop every subscriber. Only used when starting a brand new game. */
  clear(): void {
    this.handlers.clear();
  }
}

export const bus = new TypedEmitter();

/**
 * Convenience for scenes: collect unsubscribe functions and release them all on shutdown.
 *
 *   const subs = new Subscriptions();
 *   subs.add(bus.on('enemy:killed', ...));
 *   this.events.once('shutdown', () => subs.dispose());
 */
export class Subscriptions {
  private offs: Array<() => void> = [];

  add(off: () => void): void {
    this.offs.push(off);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }
}
