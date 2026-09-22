import { PAL } from '../art/palette';
import type { Cost } from './upgrades';

export const WEAPON_IDS = ['axe', 'knife', 'spear', 'bow', 'hammer', 'antler'] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

export type SwingShape = 'arc' | 'thrust' | 'circle' | 'ranged';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** One line that tells the player how it plays, not what its numbers are. */
  desc: string;
  color: string;
  /** Damage per combo step. The array length is the combo length. */
  damage: number[];
  /** Seconds. windup -> active -> recovery. Short windups feel responsive. */
  windup: number;
  active: number;
  recovery: number;
  /** How long after recovery starts the next combo step can be buffered. */
  comboWindow: number;
  shape: SwingShape;
  /** Pixels from the player's centre. */
  reach: number;
  /** Half-angle of the swing, in degrees. Ignored for thrust and circle. */
  arcDeg: number;
  /** Width of a thrust, in pixels. */
  thrustWidth: number;
  knockback: number;
  crit: number;
  /** Seconds of stun applied on the final combo hit, if any. */
  finisherStun: number;
  /** Every hit stuns for this long. Used by the Heavy Axe and the Hammer. */
  hitStun: number;
  /** A thrust or projectile passes through enemies instead of stopping. */
  pierce: boolean;
  /** Ranged weapons spend a charge per shot and regenerate one every `rechargeSec`. */
  charges: number;
  rechargeSec: number;
  projectileSpeed: number;
  /** Slow applied to whatever it hits: fraction and seconds. */
  slow: { amount: number; seconds: number } | null;
  /** How the player gets it. */
  source: 'start' | 'cache' | 'craft' | 'boss';
  craftCost?: Cost;
}

const base = {
  comboWindow: 0.45,
  arcDeg: 110,
  thrustWidth: 12,
  finisherStun: 0,
  hitStun: 0,
  pierce: false,
  charges: 0,
  rechargeSec: 0,
  projectileSpeed: 0,
  slow: null,
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  axe: {
    ...base,
    id: 'axe',
    name: 'Rusted Axe',
    desc: 'Slow, heavy, and it moves whatever it hits.',
    color: PAL.rust,
    damage: [12, 12, 18],
    windup: 0.1,
    active: 0.09,
    recovery: 0.26,
    shape: 'arc',
    reach: 24,
    arcDeg: 110,
    knockback: 150,
    crit: 0.05,
    finisherStun: 0.3,
    source: 'start',
  },
  knife: {
    ...base,
    id: 'knife',
    name: 'Hunter Knife',
    desc: 'Fast and light. Lives on lucky cuts.',
    color: PAL.steel,
    damage: [5, 5, 5, 7],
    windup: 0.04,
    active: 0.05,
    recovery: 0.09,
    comboWindow: 0.35,
    shape: 'arc',
    reach: 16,
    arcDeg: 70,
    knockback: 40,
    crit: 0.3,
    source: 'cache',
  },
  spear: {
    ...base,
    id: 'spear',
    name: 'Scrap Spear',
    desc: 'Long reach. Keeps everything at arm’s length.',
    color: PAL.gold,
    damage: [9, 9, 12],
    windup: 0.09,
    active: 0.08,
    recovery: 0.18,
    shape: 'thrust',
    reach: 36,
    arcDeg: 0,
    thrustWidth: 12,
    knockback: 130,
    crit: 0.08,
    pierce: true,
    source: 'craft',
    craftCost: { scrap: 18 },
  },
  bow: {
    ...base,
    id: 'bow',
    name: 'Frost Bow',
    desc: 'Strikes from far off and leaves the cold behind.',
    color: PAL.cyan,
    damage: [8],
    windup: 0.16,
    active: 0.04,
    recovery: 0.3,
    shape: 'ranged',
    reach: 170,
    arcDeg: 0,
    knockback: 30,
    crit: 0.12,
    charges: 3,
    rechargeSec: 2,
    projectileSpeed: 220,
    slow: { amount: 0.35, seconds: 1.5 },
    source: 'cache',
  },
  antler: {
    ...base,
    id: 'antler',
    name: 'Hollow Antler',
    desc: 'Torn from the Stag. The cold still lives in it.',
    color: PAL.ice,
    damage: [11, 11, 16],
    windup: 0.1,
    active: 0.08,
    recovery: 0.2,
    shape: 'thrust',
    reach: 40,
    arcDeg: 0,
    thrustWidth: 14,
    knockback: 120,
    crit: 0.1,
    pierce: true,
    slow: { amount: 0.4, seconds: 1.2 },
    source: 'boss',
  },
  hammer: {
    ...base,
    id: 'hammer',
    name: 'Survivor Hammer',
    desc: 'Very slow. Everything nearby stops moving.',
    color: PAL.orange,
    damage: [26],
    windup: 0.26,
    active: 0.1,
    recovery: 0.44,
    shape: 'circle',
    reach: 30,
    arcDeg: 360,
    knockback: 230,
    crit: 0.05,
    hitStun: 1.0,
    source: 'boss',
  },
};

// --- upgrade tree --------------------------------------------------------

export interface BranchDef {
  id: string;
  name: string;
  desc: string;
  cost: Cost;
  /** Multiplied into the weapon's stats. */
  damageMult?: number;
  knockbackMult?: number;
  critAdd?: number;
  reachAdd?: number;
  hitStun?: number;
  /** Flags other systems read: bleed, lifesteal, freeze, nodeBreaker, guard, pierce. */
  flags?: string[];
  /** Extra wood from nodes, for the Scavenger Axe. */
  woodBonus?: number;
  chargesAdd?: number;
}

export const REINFORCE_COST: Cost = { scrap: 15 };
export const REINFORCE_DAMAGE = 1.2;
export const BRANCH_COST: Cost = { scrap: 30, crystal: 2 };

export const BRANCHES: Record<WeaponId, [BranchDef, BranchDef]> = {
  axe: [
    {
      id: 'heavy',
      name: 'Heavy Axe',
      desc: 'Hits far harder and staggers everything it touches.',
      cost: BRANCH_COST,
      damageMult: 1.35,
      hitStun: 0.5,
    },
    {
      id: 'scavenger',
      name: 'Scavenger Axe',
      desc: 'Fells a resource node in one swing and takes more wood.',
      cost: BRANCH_COST,
      flags: ['nodeBreaker'],
      woodBonus: 0.3,
    },
  ],
  knife: [
    {
      id: 'serrated',
      name: 'Serrated Knife',
      desc: 'Leaves wounds that keep bleeding.',
      cost: BRANCH_COST,
      flags: ['bleed'],
    },
    {
      id: 'shadow',
      name: 'Shadow Knife',
      desc: 'Finds the gap far more often, and hits harder when it does.',
      cost: BRANCH_COST,
      critAdd: 0.15,
      flags: ['bigCrit'],
    },
  ],
  spear: [
    {
      id: 'pike',
      name: 'Scrap Pike',
      desc: 'Longer, and it knocks arrows and spit out of the air.',
      cost: BRANCH_COST,
      reachAdd: 12,
      flags: ['pierce', 'deflect'],
    },
    {
      id: 'guard',
      name: 'Guard Spear',
      desc: 'Shields you while you thrust, and shoves harder.',
      cost: BRANCH_COST,
      knockbackMult: 1.4,
      flags: ['guard'],
    },
  ],
  bow: [
    {
      id: 'deepfrost',
      name: 'Deep Frost Bow',
      desc: 'A third hit in a row freezes whatever it lands on.',
      cost: BRANCH_COST,
      flags: ['freeze'],
    },
    {
      id: 'rapid',
      name: 'Rapid Bow',
      desc: 'More arrows, and they come back faster.',
      cost: BRANCH_COST,
      chargesAdd: 2,
      flags: ['fastRecharge'],
    },
  ],
  antler: [
    {
      id: 'rime',
      name: 'Rime Antler',
      desc: 'What it touches freezes solid for a moment.',
      cost: BRANCH_COST,
      reachAdd: 6,
      flags: ['freeze'],
    },
    {
      id: 'tine',
      name: 'Tine Antler',
      desc: 'Longer, and a hit that lands true stops the thing dead.',
      cost: BRANCH_COST,
      reachAdd: 14,
      hitStun: 0.4,
    },
  ],
  hammer: [
    {
      id: 'quake',
      name: 'Quake Hammer',
      desc: 'The shock ring reaches further and throws harder.',
      cost: BRANCH_COST,
      reachAdd: 12,
      knockbackMult: 1.4,
    },
    {
      id: 'hearth',
      name: 'Hearth Hammer',
      desc: 'Every hit gives a little of it back to you.',
      cost: BRANCH_COST,
      flags: ['lifesteal'],
    },
  ],
};

// --- rarity modifiers ----------------------------------------------------

export interface ModifierDef {
  id: string;
  name: string;
  desc: string;
  color: string;
}

export const MODIFIERS: Record<string, ModifierDef> = {
  burning: { id: 'burning', name: 'Burning', desc: 'Sets what it hits alight.', color: PAL.ember },
  keen: { id: 'keen', name: 'Keen', desc: 'Finds the gap more often.', color: PAL.gold },
  brutal: { id: 'brutal', name: 'Brutal', desc: 'Throws enemies further.', color: PAL.rust },
  vampiric: { id: 'vampiric', name: 'Vampiric', desc: 'Returns a little health.', color: PAL.blood },
  warm: { id: 'warm', name: 'Warm', desc: 'The cold bites more slowly.', color: PAL.orange },
  lucky: { id: 'lucky', name: 'Lucky', desc: 'Enemies drop a little more.', color: PAL.green },
};

export const MODIFIER_IDS = Object.keys(MODIFIERS);
