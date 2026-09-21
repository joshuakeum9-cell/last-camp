import type { Cost } from './upgrades';

export const PERK_IDS = ['hearty', 'scavenger', 'quickstep', 'sharpedge', 'luckyfind', 'thickcoat'] as const;
export type PerkId = (typeof PERK_IDS)[number];

export interface PerkDef {
  id: PerkId;
  name: string;
  desc: string;
  /** How many times it can be bought. */
  maxLevel: number;
  /** Cost of one level. Repeatable perks cost the same each time. */
  cost: Cost;
  order: number;
}

export const PERKS: Record<PerkId, PerkDef> = {
  hearty: {
    id: 'hearty',
    name: 'Hearty',
    desc: '+10 maximum health.',
    maxLevel: 3,
    cost: { food: 6 },
    order: 1,
  },
  sharpedge: {
    id: 'sharpedge',
    name: 'Sharp Edge',
    desc: '+5% weapon damage.',
    maxLevel: 3,
    cost: { scrap: 8 },
    order: 2,
  },
  scavenger: {
    id: 'scavenger',
    name: 'Scavenger',
    desc: '+10% from everything you gather.',
    maxLevel: 1,
    cost: { scrap: 12 },
    order: 3,
  },
  quickstep: {
    id: 'quickstep',
    name: 'Quick Step',
    desc: 'Your dash recovers faster.',
    maxLevel: 1,
    cost: { scrap: 10, food: 4 },
    order: 4,
  },
  thickcoat: {
    id: 'thickcoat',
    name: 'Thick Coat',
    desc: 'The cold takes hold 15% slower.',
    maxLevel: 1,
    cost: { wood: 10, food: 6 },
    order: 5,
  },
  luckyfind: {
    id: 'luckyfind',
    name: 'Lucky Find',
    desc: 'Better things turn up in caches.',
    maxLevel: 1,
    cost: { crystal: 2 },
    order: 6,
  },
};

export const PERK_LIST = PERK_IDS.map((id) => PERKS[id]).sort((a, b) => a.order - b.order);

export function emptyPerks(): Record<PerkId, number> {
  return { hearty: 0, scavenger: 0, quickstep: 0, sharpedge: 0, luckyfind: 0, thickcoat: 0 };
}
