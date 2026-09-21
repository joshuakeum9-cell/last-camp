import { PAL } from '../art/palette';

export const AREA_IDS = [
  'gate',
  'forest',
  'road',
  'cabin',
  'lake',
  'bossden',
  'secret',
  'towerpass',
] as const;
export type AreaId = (typeof AREA_IDS)[number];

/** Tile space rectangle, inclusive of x0/y0, exclusive of x1/y1. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type GroundKind = 'snow' | 'deep' | 'road' | 'ice' | 'floor' | 'camp';

export interface AreaDef {
  id: AreaId;
  name: string;
  rect: Rect;
  ground: GroundKind;
  /** Tint applied to this area's ambient light, for a little per-area mood. */
  tint: string;
  /** Cold gain multiplier while standing here. */
  coldMult: number;
  /** Hidden areas do not announce themselves and are not drawn on the map until found. */
  hidden?: boolean;
  /** Locked areas cannot be entered in the MVP. */
  locked?: boolean;
  /** Shown as a banner when first entered. Hidden and locked areas skip it. */
  announce: boolean;
  /** Rough density of scenery per 100 tiles, used by MapGen. */
  scenery: { trees: number; rocks: number; wrecks: number; crystals: number };
}

export const AREAS: Record<AreaId, AreaDef> = {
  gate: {
    id: 'gate',
    name: 'Camp Gate',
    rect: { x0: 2, y0: 24, x1: 9, y1: 35 },
    ground: 'camp',
    tint: PAL.orange,
    coldMult: 0.4,
    announce: false,
    scenery: { trees: 1, rocks: 1, wrecks: 0, crystals: 0 },
  },
  forest: {
    id: 'forest',
    name: 'Frozen Forest',
    rect: { x0: 2, y0: 6, x1: 34, y1: 54 },
    ground: 'snow',
    tint: PAL.blue,
    coldMult: 1.0,
    announce: true,
    scenery: { trees: 8, rocks: 3, wrecks: 0, crystals: 0 },
  },
  road: {
    id: 'road',
    name: 'Abandoned Road',
    rect: { x0: 34, y0: 6, x1: 60, y1: 32 },
    ground: 'road',
    tint: PAL.violet,
    coldMult: 1.0,
    announce: true,
    scenery: { trees: 3, rocks: 4, wrecks: 8, crystals: 0 },
  },
  cabin: {
    id: 'cabin',
    name: 'Ruined Cabin',
    rect: { x0: 60, y0: 6, x1: 85, y1: 32 },
    ground: 'snow',
    tint: PAL.violetDark,
    coldMult: 1.0,
    announce: true,
    scenery: { trees: 4, rocks: 4, wrecks: 4, crystals: 1 },
  },
  lake: {
    id: 'lake',
    name: 'Frozen Lake',
    rect: { x0: 34, y0: 32, x1: 67, y1: 54 },
    ground: 'ice',
    tint: PAL.ice,
    coldMult: 1.5,
    announce: true,
    scenery: { trees: 2, rocks: 3, wrecks: 2, crystals: 6 },
  },
  secret: {
    id: 'secret',
    name: 'Hollow Under the Ice',
    rect: { x0: 69, y0: 40, x1: 77, y1: 54 },
    ground: 'deep',
    tint: PAL.magenta,
    coldMult: 1.2,
    hidden: true,
    announce: true,
    scenery: { trees: 0, rocks: 6, wrecks: 1, crystals: 8 },
  },
  bossden: {
    id: 'bossden',
    name: "The Maw's Den",
    rect: { x0: 79, y0: 33, x1: 98, y1: 54 },
    ground: 'deep',
    tint: PAL.deep,
    coldMult: 1.5,
    announce: true,
    scenery: { trees: 2, rocks: 8, wrecks: 0, crystals: 2 },
  },
  towerpass: {
    id: 'towerpass',
    name: 'Signal Tower Pass',
    rect: { x0: 87, y0: 6, x1: 98, y1: 31 },
    ground: 'deep',
    tint: PAL.cyan,
    coldMult: 2.0,
    locked: true,
    announce: false,
    scenery: { trees: 0, rocks: 4, wrecks: 0, crystals: 3 },
  },
};

export const AREA_LIST = AREA_IDS.map((id) => AREAS[id]);

/** Walkable links carved between area rectangles. */
export interface Corridor {
  rect: Rect;
  ground: GroundKind;
  /** If set, a gate blocks this corridor until opened. */
  gate?: GateId;
}

export const GATE_IDS = ['bossSnowbank', 'secretIce', 'towerIce'] as const;
export type GateId = (typeof GATE_IDS)[number];

export interface GateDef {
  id: GateId;
  rect: Rect;
  /** How it opens: hit it, or never (MVP lock). */
  kind: 'breakable' | 'locked';
  hits: number;
  /** Message shown when the player interacts with a locked gate. */
  message: string;
  /** Hidden gates have no prompt until the player is standing on them. */
  hidden?: boolean;
}

export const GATES: Record<GateId, GateDef> = {
  bossSnowbank: {
    id: 'bossSnowbank',
    rect: { x0: 76, y0: 33, x1: 79, y1: 40 },
    kind: 'breakable',
    hits: 3,
    message: 'A packed wall of snow. Something big goes in and out of here.',
  },
  secretIce: {
    id: 'secretIce',
    rect: { x0: 67, y0: 45, x1: 69, y1: 49 },
    kind: 'breakable',
    hits: 2,
    message: 'The ice here is thin and glassy. It hums when you step on it.',
    hidden: true,
  },
  towerIce: {
    id: 'towerIce',
    rect: { x0: 85, y0: 13, x1: 87, y1: 18 },
    kind: 'locked',
    hits: 0,
    message: 'A wall of blue ice blocks the pass. It hums. Nothing you carry will cut it.',
  },
};

/**
 * Areas now touch each other directly, so nearly every corridor is gone. What is left
 * is the three passages that have a gate in them, because a gate needs a wall on
 * either side of it to mean anything.
 */
export const CORRIDORS: Corridor[] = [
  { rect: { x0: 66, y0: 33, x1: 80, y1: 40 }, ground: 'deep', gate: 'bossSnowbank' },
  { rect: { x0: 67, y0: 45, x1: 69, y1: 49 }, ground: 'ice', gate: 'secretIce' },
  { rect: { x0: 85, y0: 13, x1: 87, y1: 18 }, ground: 'deep', gate: 'towerIce' },
];

/** Where the player appears when they leave camp, in tiles. */
export const WORLD_SPAWN = { x: 5, y: 29 };

/** Standing inside this rect lets the player return to camp. */
export const RETURN_ZONE: Rect = { x0: 2, y0: 25, x1: 6, y1: 34 };

export function rectContains(r: Rect, tx: number, ty: number): boolean {
  return tx >= r.x0 && tx < r.x1 && ty >= r.y0 && ty < r.y1;
}

export function areaAtTile(tx: number, ty: number): AreaDef | null {
  for (const a of AREA_LIST) {
    if (rectContains(a.rect, tx, ty)) return a;
  }
  return null;
}

export function rectCenterPx(r: Rect, tile: number): { x: number; y: number } {
  return { x: ((r.x0 + r.x1) / 2) * tile, y: ((r.y0 + r.y1) / 2) * tile };
}
