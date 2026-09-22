import type { ResourceId } from './resources';
import { hashString } from '../core/Rng';
import { BAL } from './balance';

/**
 * The day's event. Every expedition has one, chosen from the day number so the
 * morning report and the world agree on it. Most days are ordinary; the rest bend
 * one thing so a day out feels different from the last one.
 */
export type DayEventId = 'clear' | 'whiteout' | 'wolfmoon' | 'richvein' | 'blizzard' | 'stillair';

export interface DayEventDef {
  id: DayEventId;
  name: string;
  /** The morning report line at camp. */
  report: string;
  /** Screen-space fog, 0 to 1. */
  fog: number;
  /** Multiplier on how many enemy groups spawn. */
  spawnMult: number;
  /** Multiplier on how fast the cold climbs. */
  coldMult: number;
  /** Multiplier on what a node or drop gives, per resource. */
  yields: Partial<Record<ResourceId, number>>;
  /** Blizzards are the storm: heavy snow and constant wind. */
  storm: boolean;
  weight: number;
}

export const DAY_EVENTS: Record<DayEventId, DayEventDef> = {
  clear: {
    id: 'clear',
    name: 'Clear',
    report: '',
    fog: 0,
    spawnMult: 1,
    coldMult: 1,
    yields: {},
    storm: false,
    weight: 4,
  },
  whiteout: {
    id: 'whiteout',
    name: 'Whiteout',
    report: 'Fog on the valley. You will not see them coming, and they will not see you.',
    fog: 0.75,
    spawnMult: 0.8,
    coldMult: 1.1,
    yields: { food: 1.3 },
    storm: false,
    weight: 2,
  },
  wolfmoon: {
    id: 'wolfmoon',
    name: 'Wolf Moon',
    report: 'The wolves were loud all night. Everything out there is carrying scrap.',
    fog: 0,
    spawnMult: 1.3,
    coldMult: 1,
    yields: { scrap: 1.6 },
    storm: false,
    weight: 2,
  },
  richvein: {
    id: 'richvein',
    name: 'Rich Vein',
    report: 'Frost crystal is blooming on the ice. It will not last.',
    fog: 0,
    spawnMult: 1.1,
    coldMult: 1,
    yields: { crystal: 2 },
    storm: false,
    weight: 2,
  },
  blizzard: {
    id: 'blizzard',
    name: 'Blizzard',
    report: 'A storm is coming in. The cold will bite harder, and the wind is bringing branches down.',
    fog: 0.3,
    spawnMult: 0.7,
    coldMult: 1,
    yields: { wood: 1.4 },
    storm: true,
    weight: 2,
  },
  stillair: {
    id: 'stillair',
    name: 'Still Air',
    report: 'No wind at all. The cold is gentle today, and everything can hear you.',
    fog: 0,
    spawnMult: 1.25,
    coldMult: 0.7,
    yields: {},
    storm: false,
    weight: 2,
  },
};

/** Day one is always clear, so the first trip out teaches only the basics. */
export function eventForDay(day: number, salt: number): DayEventDef {
  if (day <= 1) return DAY_EVENTS.clear;
  const pool = Object.values(DAY_EVENTS).filter((e) => !e.storm || day >= BAL.day.stormFromDay);
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = (hashString(`event:${day}:${salt}`) % 1000) / 1000 * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return DAY_EVENTS.clear;
}

/** The event of the run in progress, or clear when there is none. */
export function activeEvent(eventId: string | undefined): DayEventDef {
  return DAY_EVENTS[(eventId as DayEventId) ?? 'clear'] ?? DAY_EVENTS.clear;
}
