import type { ResourceId } from './resources';
import type { WeaponId } from './weapons';
import type { AreaId } from './areas';

/** A cache the player can open once per save. */
export interface CacheDef {
  id: string;
  area: AreaId;
  /** Tile position. Fixed caches sit in places worth walking to. */
  tx: number;
  ty: number;
  /** A guaranteed weapon, for the caches that exist to hand one over. */
  weapon?: WeaponId;
  /** Forced rarity, when the contents are the point rather than the roll. */
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic';
  /** A note found inside. */
  note?: string;
  /** One line shown when it opens. */
  flavour: string;
}

/**
 * Fixed caches. Everything important the player can find is placed by hand, so
 * progression never depends on a roll going their way.
 */
export const CACHES: CacheDef[] = [
  {
    id: 'forest-first',
    area: 'forest',
    tx: 18,
    ty: 22,
    rarity: 'uncommon',
    flavour: 'A ranger’s pack, frozen shut. You get it open.',
  },
  {
    id: 'forest-deep',
    area: 'forest',
    tx: 27,
    ty: 45,
    rarity: 'uncommon',
    flavour: 'Somebody cached this and never came back for it.',
  },
  {
    id: 'road-knife',
    area: 'road',
    tx: 46,
    ty: 18,
    weapon: 'knife',
    rarity: 'uncommon',
    flavour: 'A hunter’s kit in the footwell. The knife is still sharp.',
  },
  {
    id: 'road-wreck',
    area: 'road',
    tx: 53,
    ty: 11,
    rarity: 'rare',
    flavour: 'The boot of a car that was packed in a hurry.',
  },
  {
    id: 'cabin-store',
    area: 'cabin',
    tx: 70,
    ty: 14,
    rarity: 'rare',
    flavour: 'Under a loose board, where you would put something you valued.',
  },
  {
    id: 'lake-tent',
    area: 'lake',
    tx: 44,
    ty: 47,
    rarity: 'rare',
    flavour: 'A tent pitched on the ice. Whoever pitched it is not here.',
  },
  {
    id: 'secret-bow',
    area: 'secret',
    tx: 73,
    ty: 47,
    weapon: 'bow',
    rarity: 'epic',
    flavour: 'It has been waiting down here a long time.',
  },
  {
    id: 'bossden-hoard',
    area: 'bossden',
    tx: 90,
    ty: 45,
    rarity: 'epic',
    flavour: 'A heap of what it took from everyone before you.',
  },
];

/** What a cache of a given rarity holds, before the yield multiplier. */
export const CACHE_RESOURCES: Record<string, Array<{ id: ResourceId; min: number; max: number }>> = {
  common: [
    { id: 'wood', min: 3, max: 6 },
    { id: 'scrap', min: 2, max: 4 },
  ],
  uncommon: [
    { id: 'wood', min: 4, max: 8 },
    { id: 'scrap', min: 4, max: 7 },
    { id: 'food', min: 1, max: 3 },
  ],
  rare: [
    { id: 'scrap', min: 6, max: 10 },
    { id: 'food', min: 2, max: 4 },
    { id: 'crystal', min: 1, max: 2 },
  ],
  epic: [
    { id: 'scrap', min: 10, max: 16 },
    { id: 'crystal', min: 2, max: 4 },
    { id: 'medical', min: 1, max: 2 },
  ],
};

/** Chance a cache of each rarity also contains a random weapon. */
export const CACHE_WEAPON_CHANCE: Record<string, number> = {
  common: 0,
  uncommon: 0.1,
  rare: 0.25,
  epic: 0.45,
};
