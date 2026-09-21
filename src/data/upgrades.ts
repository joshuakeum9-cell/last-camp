import type { ResourceId } from './resources';

export const UPGRADE_IDS = [
  'fire1',
  'fire2',
  'shelter1',
  'shelter2',
  'workbench',
  'storage1',
  'storage2',
  'cookpot',
  'scavrack',
  'medtable',
  'weaponrack',
  'watchtower',
  'lantern',
  'signaltable',
  'trophy',
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export type Cost = Partial<Record<ResourceId, number>>;

/**
 * Aggregated by UpgradeSystem: within a `group` only the best owned tier counts, and the
 * results are then summed across groups. Cold resistance is capped in balance.ts.
 */
export interface UpgradeEffects {
  coldResist?: number;
  maxHp?: number;
  /** Fraction of the run's haul kept on death. */
  deathKeep?: number;
  foodHeal?: number;
  yieldMult?: number;
  weaponSlots?: number;
  fireLightMult?: number;
  playerLightMult?: number;
  damageMult?: number;
  /** Feature flags other systems read: workbench, broth, medtable, mapCaches, clockSeconds. */
  unlocks?: string[];
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  cost: Cost;
  /** One short line the player reads before buying. */
  effect: string;
  /** What changes at camp, shown under the effect. */
  campChange: string;
  effects: UpgradeEffects;
  group?: string;
  requires?: { upgrade?: UpgradeId; mira?: boolean; boss?: boolean };
  /** Trophy is awarded, never bought. */
  awarded?: boolean;
  /** Sort order in the menu. */
  order: number;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  fire1: {
    id: 'fire1',
    name: 'Better Fire',
    cost: { wood: 10 },
    effect: 'The cold takes hold 20% slower.',
    campChange: 'The fire grows, ringed with stone.',
    effects: { coldResist: 0.2 },
    group: 'fire',
    order: 1,
  },
  fire2: {
    id: 'fire2',
    name: 'Roaring Fire',
    cost: { wood: 25, crystal: 1 },
    effect: 'The cold takes hold 35% slower. Firelight reaches further.',
    campChange: 'Tall flames and drifting embers.',
    effects: { coldResist: 0.35, fireLightMult: 1.5 },
    group: 'fire',
    requires: { upgrade: 'fire1' },
    order: 2,
  },
  shelter1: {
    id: 'shelter1',
    name: 'Patched Shelter',
    cost: { wood: 15, scrap: 5 },
    effect: '+20 maximum health.',
    campChange: 'The tent is stitched and staked down.',
    effects: { maxHp: 20 },
    group: 'shelter',
    order: 3,
  },
  shelter2: {
    id: 'shelter2',
    name: 'Fortified Shelter',
    cost: { wood: 30, scrap: 15 },
    effect: '+50 maximum health.',
    campChange: 'Log walls close in around the fire.',
    effects: { maxHp: 50 },
    group: 'shelter',
    requires: { upgrade: 'shelter1' },
    order: 4,
  },
  workbench: {
    id: 'workbench',
    name: 'Workbench',
    cost: { wood: 12, scrap: 10 },
    effect: 'Upgrade weapons, craft the Scrap Spear.',
    campChange: 'A bench of salvaged tools.',
    effects: { unlocks: ['workbench'] },
    order: 5,
  },
  storage1: {
    id: 'storage1',
    name: 'Storage Crate',
    cost: { wood: 10, scrap: 8 },
    effect: 'Keep 75% of your haul if you fall.',
    campChange: 'A crate beside the tent.',
    effects: { deathKeep: 0.75 },
    group: 'storage',
    order: 6,
  },
  storage2: {
    id: 'storage2',
    name: 'Supply Store',
    cost: { wood: 25, scrap: 20 },
    effect: 'Keep 90% of your haul if you fall.',
    campChange: 'Crates stacked under a tarp.',
    effects: { deathKeep: 0.9 },
    group: 'storage',
    requires: { upgrade: 'storage1' },
    order: 7,
  },
  cookpot: {
    id: 'cookpot',
    name: 'Cooking Pot',
    cost: { scrap: 12, food: 5 },
    effect: 'Food heals far more. Cook Warm Broth.',
    campChange: 'A pot hangs over the fire.',
    effects: { foodHeal: 25, unlocks: ['broth'] },
    order: 8,
  },
  scavrack: {
    id: 'scavrack',
    name: 'Scavenger Rack',
    cost: { wood: 20, scrap: 10 },
    effect: '+15% from everything you gather.',
    campChange: 'A drying rack hung with salvage.',
    effects: { yieldMult: 0.15 },
    order: 9,
  },
  medtable: {
    id: 'medtable',
    name: 'Medical Table',
    cost: { scrap: 20, medical: 1 },
    effect: 'Medical supplies heal fully and drive off the cold.',
    campChange: 'A table of bottles and clean cloth.',
    effects: { unlocks: ['medtable'] },
    order: 10,
  },
  weaponrack: {
    id: 'weaponrack',
    name: 'Weapon Rack',
    cost: { wood: 15, scrap: 15 },
    effect: 'Carry a second weapon and swap in the field.',
    campChange: 'A rack of hanging weapons.',
    effects: { weaponSlots: 1 },
    order: 11,
  },
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    cost: { wood: 40, scrap: 20 },
    effect: 'Your map shows caches. Your clock shows the exact time left.',
    campChange: 'A timber tower over the camp.',
    effects: { unlocks: ['mapCaches', 'clockSeconds'] },
    order: 12,
  },
  lantern: {
    id: 'lantern',
    name: 'Ember Lantern',
    cost: { scrap: 15, crystal: 2 },
    effect: 'You carry light into the dark. The cold bites 10% less.',
    campChange: 'Lanterns burn on every post.',
    effects: { playerLightMult: 2, coldResist: 0.1 },
    requires: { mira: true },
    order: 13,
  },
  signaltable: {
    id: 'signaltable',
    name: 'Signal Table',
    cost: { scrap: 30, crystal: 3 },
    effect: 'Begin the work of answering the tower.',
    campChange: 'A radio set that will not stop flickering.',
    effects: {},
    requires: { mira: true, boss: true },
    order: 14,
  },
  trophy: {
    id: 'trophy',
    name: 'Maw Trophy',
    cost: {},
    effect: '+5% damage. Everything here has seen what you killed.',
    campChange: 'A great white skull over the gate.',
    effects: { damageMult: 0.05 },
    awarded: true,
    order: 15,
  },
};

export const UPGRADE_LIST = UPGRADE_IDS.map((id) => UPGRADES[id]).sort((a, b) => a.order - b.order);

/** Camp level from the number of distinct upgrades owned. Drives the whole camp layout. */
export function campLevelFor(count: number): 1 | 2 | 3 | 4 | 5 {
  if (count >= 11) return 5;
  if (count >= 8) return 4;
  if (count >= 5) return 3;
  if (count >= 2) return 2;
  return 1;
}
