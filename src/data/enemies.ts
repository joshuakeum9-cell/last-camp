import { PAL } from '../art/palette';
import type { ResourceId } from './resources';

export const ENEMY_IDS = ['rat', 'wolf', 'walker', 'spitter', 'alpha', 'stalker'] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export type TelegraphShape = 'line' | 'circle' | 'mark';

export interface DropChance {
  id: ResourceId;
  chance: number;
  min: number;
  max: number;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  color: string;
  /** The one colour on the body that also drives its hit particles. */
  accent: string;
  hp: number;
  damage: number;
  speed: number;
  /** Charge or lunge speed, when the attack moves the enemy. */
  rushSpeed: number;
  /** How close it gets before attacking. */
  attackRange: number;
  /** Preferred distance. Ranged enemies keep this gap. */
  keepDistance: number;
  /** How far it notices the player. */
  aggroRange: number;
  windup: number;
  active: number;
  recovery: number;
  /** Seconds between attacks. */
  cooldown: number;
  telegraph: TelegraphShape;
  /** Radius or length of the telegraph indicator, in pixels. */
  telegraphSize: number;
  /** Light enemies are interrupted when hit during windup. */
  interruptible: boolean;
  /** How hard it is to push. 1 is normal, higher resists knockback. */
  mass: number;
  /** Pack size at day 1. Day scaling adds to this. */
  pack: [number, number];
  drops: DropChance[];
  /** What this enemy exists to teach the player. Shown in the dev screen. */
  teaches: string;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  rat: {
    id: 'rat',
    name: 'Frost Rat',
    color: PAL.grey,
    accent: PAL.magenta,
    hp: 14,
    damage: 6,
    speed: 110,
    rushSpeed: 200,
    attackRange: 20,
    keepDistance: 0,
    aggroRange: 150,
    windup: 0.3,
    active: 0.1,
    recovery: 0.35,
    cooldown: 0.9,
    telegraph: 'mark',
    telegraphSize: 10,
    interruptible: true,
    mass: 0.7,
    pack: [3, 5],
    drops: [{ id: 'food', chance: 0.3, min: 1, max: 1 }],
    teaches: 'Crowd control. Keep swinging, keep moving.',
  },
  wolf: {
    id: 'wolf',
    name: 'Ice Wolf',
    color: PAL.snowShade,
    accent: PAL.cyan,
    hp: 40,
    damage: 14,
    speed: 75,
    rushSpeed: 260,
    attackRange: 120,
    keepDistance: 90,
    aggroRange: 230,
    windup: 0.6,
    active: 0.45,
    recovery: 0.8,
    cooldown: 1.9,
    telegraph: 'line',
    telegraphSize: 130,
    interruptible: false,
    mass: 1.1,
    pack: [1, 2],
    drops: [
      { id: 'food', chance: 0.4, min: 1, max: 2 },
      { id: 'scrap', chance: 0.25, min: 1, max: 1 },
    ],
    teaches: 'Dodge timing. The recovery after a charge is your window.',
  },
  walker: {
    id: 'walker',
    name: 'Frozen Walker',
    color: PAL.violetDark,
    accent: PAL.violet,
    hp: 90,
    damage: 22,
    speed: 35,
    rushSpeed: 35,
    attackRange: 26,
    keepDistance: 0,
    aggroRange: 190,
    windup: 0.9,
    active: 0.16,
    recovery: 0.7,
    cooldown: 1.6,
    telegraph: 'circle',
    telegraphSize: 26,
    interruptible: false,
    mass: 2.4,
    pack: [1, 2],
    drops: [
      { id: 'scrap', chance: 0.6, min: 1, max: 3 },
      { id: 'crystal', chance: 0.15, min: 1, max: 1 },
    ],
    teaches: 'Patience. It cannot be staggered, so you have to move.',
  },
  spitter: {
    id: 'spitter',
    name: 'Snow Spitter',
    color: PAL.teal,
    accent: PAL.green,
    hp: 30,
    damage: 8,
    speed: 60,
    rushSpeed: 60,
    attackRange: 150,
    keepDistance: 100,
    aggroRange: 220,
    windup: 0.55,
    active: 0.08,
    recovery: 0.5,
    cooldown: 2.0,
    telegraph: 'mark',
    telegraphSize: 12,
    interruptible: true,
    mass: 1,
    pack: [1, 3],
    drops: [
      { id: 'crystal', chance: 0.2, min: 1, max: 1 },
      { id: 'scrap', chance: 0.3, min: 1, max: 2 },
    ],
    teaches: 'Keep moving. Standing still is what kills you.',
  },
  alpha: {
    id: 'alpha',
    name: 'Alpha Beast',
    color: PAL.woodDark,
    accent: PAL.ember,
    hp: 260,
    damage: 18,
    speed: 70,
    rushSpeed: 240,
    attackRange: 140,
    keepDistance: 0,
    aggroRange: 300,
    windup: 0.7,
    active: 0.4,
    recovery: 0.9,
    cooldown: 1.8,
    telegraph: 'line',
    telegraphSize: 150,
    interruptible: false,
    mass: 4,
    pack: [1, 1],
    drops: [
      { id: 'medical', chance: 1, min: 2, max: 2 },
      { id: 'crystal', chance: 1, min: 3, max: 3 },
    ],
    teaches: 'Everything at once. Read the tell, then punish.',
  },
  stalker: {
    id: 'stalker',
    name: 'Night Stalker',
    color: PAL.white,
    accent: PAL.ice,
    hp: 55,
    damage: 18,
    speed: 95,
    rushSpeed: 310,
    attackRange: 140,
    keepDistance: 80,
    aggroRange: 300,
    windup: 0.5,
    active: 0.45,
    recovery: 0.7,
    cooldown: 1.6,
    telegraph: 'line',
    telegraphSize: 150,
    interruptible: false,
    mass: 1.1,
    pack: [1, 1],
    drops: [
      { id: 'food', chance: 0.6, min: 2, max: 3 },
      { id: 'crystal', chance: 0.4, min: 1, max: 2 },
    ],
    teaches: 'The night has something in it that the day does not.',
  },
};

/** Which enemies can appear in which area, and from which day. */
export interface SpawnRule {
  id: EnemyId;
  fromDay: number;
  weight: number;
}

export const AREA_SPAWNS: Record<string, SpawnRule[]> = {
  gate: [],
  forest: [
    { id: 'rat', fromDay: 1, weight: 70 },
    { id: 'wolf', fromDay: 2, weight: 30 },
  ],
  road: [
    { id: 'rat', fromDay: 1, weight: 30 },
    { id: 'wolf', fromDay: 2, weight: 40 },
    { id: 'walker', fromDay: 3, weight: 30 },
  ],
  cabin: [
    { id: 'wolf', fromDay: 2, weight: 35 },
    { id: 'walker', fromDay: 3, weight: 45 },
    { id: 'spitter', fromDay: 4, weight: 20 },
  ],
  lake: [
    { id: 'spitter', fromDay: 1, weight: 45 },
    { id: 'wolf', fromDay: 2, weight: 25 },
    { id: 'walker', fromDay: 3, weight: 30 },
  ],
  secret: [{ id: 'spitter', fromDay: 1, weight: 100 }],
  bossden: [{ id: 'walker', fromDay: 1, weight: 100 }],
  towerpass: [],
};

/**
 * Packs per 100 tiles of an area, before day scaling. Deliberately low: the Frozen
 * Forest should hold four or five encounters you can choose to take, not a swarm.
 */
export const SPAWN_DENSITY = 0.42;
