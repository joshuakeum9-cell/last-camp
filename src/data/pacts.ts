import { state } from '../core/GameState';
import { hashString, Rng } from '../core/Rng';

/**
 * What you take with you. Before every expedition the game deals three of these
 * and you keep one for the day.
 *
 * This is the one decision the valley does not make for you. The day's weather,
 * its challenge and its trader are all dealt out; this is the place where the
 * player answers back. Every pact is a real gain paid for with a real loss, in
 * the way Hades sells a boon and Slay the Spire sells a card, so the pick is
 * about the day you are planning rather than which number is biggest.
 */
export type PactId =
  | 'sharpened'
  | 'longcoat'
  | 'lightfingers'
  | 'fullbelly'
  | 'quietboots'
  | 'secondwind'
  | 'ironhide'
  | 'thinblood';

export interface PactDef {
  id: PactId;
  name: string;
  /** What it gives, in the player's words. */
  boon: string;
  /** What it costs, in the player's words. */
  cost: string;
  damageMult?: number;
  damageTakenMult?: number;
  coldMult?: number;
  yieldMult?: number;
  speedMult?: number;
  /** Multiplies how far things notice you from. */
  aggroMult?: number;
  maxHpBonus?: number;
  /** The first death this day gives back a third of your health instead. */
  revive?: boolean;
}

export const PACTS: Record<PactId, PactDef> = {
  sharpened: {
    id: 'sharpened',
    name: 'Sharpened',
    boon: 'You hit a third harder.',
    cost: 'Everything hits you a fifth harder.',
    damageMult: 1.3,
    damageTakenMult: 1.2,
  },
  longcoat: {
    id: 'longcoat',
    name: 'Long Coat',
    boon: 'The cold climbs a third slower.',
    cost: 'You walk a little heavier.',
    coldMult: 0.68,
    speedMult: 0.92,
  },
  lightfingers: {
    id: 'lightfingers',
    name: 'Light Fingers',
    boon: 'A third more from everything you gather.',
    cost: 'The cold climbs a fifth faster.',
    yieldMult: 1.33,
    coldMult: 1.2,
  },
  fullbelly: {
    id: 'fullbelly',
    name: 'Full Belly',
    boon: 'Twenty more health, today only.',
    cost: 'A sixth less from everything you gather.',
    maxHpBonus: 20,
    yieldMult: 0.84,
  },
  quietboots: {
    id: 'quietboots',
    name: 'Quiet Boots',
    boon: 'Things notice you from a third closer.',
    cost: 'You hit a sixth softer.',
    aggroMult: 0.66,
    damageMult: 0.84,
  },
  secondwind: {
    id: 'secondwind',
    name: 'Second Wind',
    boon: 'The first thing that kills you does not.',
    cost: 'A fifth less from everything you gather.',
    revive: true,
    yieldMult: 0.8,
  },
  ironhide: {
    id: 'ironhide',
    name: 'Iron Hide',
    boon: 'Everything hits you a quarter softer.',
    cost: 'You hit a sixth softer.',
    damageTakenMult: 0.75,
    damageMult: 0.84,
  },
  thinblood: {
    id: 'thinblood',
    name: 'Thin Blood',
    boon: 'You move an eighth faster.',
    cost: 'The cold climbs a quarter faster.',
    speedMult: 1.12,
    coldMult: 1.25,
  },
};

export const PACT_IDS = Object.keys(PACTS) as PactId[];

/**
 * The three on offer this morning. Seeded from the day so the hand is the same
 * one whether you look at it now or after a restart, and different tomorrow.
 */
export function pactHand(day: number, salt = 0): PactDef[] {
  const rng = new Rng(hashString(`pact:${day}:${salt}`));
  const pool = [...PACT_IDS];
  const out: PactDef[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    out.push(PACTS[pool.splice(rng.int(0, pool.length - 1), 1)[0]]);
  }
  return out;
}

function active(): PactDef | null {
  const id = state.run?.pact as PactId | null | undefined;
  return id ? PACTS[id] ?? null : null;
}

/** The day's pact as numbers, 1 everywhere when no pact is held. */
export const PACT = {
  def: active,
  damageMult: () => active()?.damageMult ?? 1,
  damageTakenMult: () => active()?.damageTakenMult ?? 1,
  coldMult: () => active()?.coldMult ?? 1,
  yieldMult: () => active()?.yieldMult ?? 1,
  speedMult: () => active()?.speedMult ?? 1,
  aggroMult: () => active()?.aggroMult ?? 1,
  maxHpBonus: () => active()?.maxHpBonus ?? 0,
  hasRevive: () => !!active()?.revive && !state.run?.pactUsed,
};
