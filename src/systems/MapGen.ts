import {
  AREA_LIST,
  CORRIDORS,
  GATES,
  GATE_IDS,
  WORLD_SPAWN,
  rectContains,
  type AreaDef,
  type AreaId,
  type GateId,
  type Rect,
} from '../data/areas';
import { BAL } from '../data/balance';
import { GATE_TILE, GROUND_TILES, TILE } from '../art/sprites/tiles';
import { Rng, subSeed } from '../core/Rng';

export type PropKind = 'pine' | 'pineSmall' | 'deadTree' | 'rock' | 'rockSmall' | 'wreck' | 'crystal' | 'bush';

export interface PropPlacement {
  kind: PropKind;
  /** Tile coordinates. Props are drawn bottom-anchored to the tile's bottom edge. */
  tx: number;
  ty: number;
  area: AreaId;
}

export type DecorKind =
  | 'fallenLog'
  | 'snowMound'
  | 'deadShrub'
  | 'grassTuft'
  | 'bones'
  | 'signpost'
  | 'oldFire'
  | 'lampPost'
  | 'stump'
  | 'skull'
  | 'iceCrack'
  | 'reeds'
  | 'glowShroom'
  | 'fence'
  | 'tyre'
  | 'clawMarks'
  | 'rockSpire';

/**
 * What turns up in each area. This is most of what makes the areas feel like
 * different places rather than different palettes: a road has lamps and tyres, a
 * lake has reeds and thin ice, the den has what the Maw left behind.
 */
const DECOR_TABLE: Record<AreaId, DecorKind[]> = {
  gate: ['grassTuft', 'snowMound', 'stump'],
  forest: ['fallenLog', 'stump', 'deadShrub', 'grassTuft', 'snowMound', 'oldFire', 'stump', 'fallenLog'],
  road: ['signpost', 'lampPost', 'tyre', 'bones', 'snowMound', 'oldFire', 'deadShrub', 'lampPost', 'tyre'],
  cabin: ['fence', 'stump', 'fallenLog', 'oldFire', 'snowMound', 'grassTuft', 'fence'],
  lake: ['iceCrack', 'reeds', 'snowMound', 'bones', 'iceCrack', 'reeds', 'iceCrack'],
  secret: ['glowShroom', 'glowShroom', 'bones', 'snowMound', 'glowShroom'],
  bossden: ['skull', 'bones', 'clawMarks', 'snowMound', 'oldFire', 'skull', 'clawMarks'],
  towerpass: ['rockSpire', 'snowMound', 'bones', 'signpost', 'oldFire', 'rockSpire'],
};

/** Scenery that is only there to look at. Nothing blocks, nothing can be harvested. */
export interface DecorPlacement {
  kind: DecorKind;
  tx: number;
  ty: number;
  area: AreaId;
}

export interface WorldMapData {
  tiles: number[][];
  /** Ground name per tile, or null where solid. Used to build feathered seams. */
  kinds: Array<Array<string | null>>;
  props: PropPlacement[];
  decor: DecorPlacement[];
  /** Tiles belonging to each gate, so opening one can clear them. */
  gateTiles: Record<GateId, Array<{ x: number; y: number }>>;
  /**
   * The rectangle the player can actually reach, in pixels. The camera is clamped to
   * this so the edge of the map is never on screen: what you can see is what you can
   * walk to.
   */
  walkable: { x: number; y: number; width: number; height: number };
}

const { cols, rows } = BAL.world;
const TILE_PX = BAL.tile;

/** Props that block movement, used by WorldScene to add static bodies. */
export const SOLID_PROPS: PropKind[] = ['pine', 'deadTree', 'rock', 'wreck', 'crystal'];

/**
 * Build the whole wilderness from the area rectangles. Everything starts as cliff and the
 * areas and corridors are carved out of it, which guarantees the map is exactly as connected
 * as data/areas.ts says it is.
 */
export function generateWorld(seed: number): WorldMapData {
  const rng = new Rng(subSeed(seed, 'world'));

  // Ground is decided as a kind first and only turned into tiles at the end, so the
  // seams between areas can be dithered rather than left as hard rectangle edges.
  const kinds: Array<Array<string | null>> = [];
  for (let y = 0; y < rows; y++) kinds.push(new Array<string | null>(cols).fill(null));

  const carve = (rect: Rect, ground: string) => {
    for (let y = Math.max(0, rect.y0); y < Math.min(rows, rect.y1); y++) {
      for (let x = Math.max(0, rect.x0); x < Math.min(cols, rect.x1); x++) {
        kinds[y][x] = ground;
      }
    }
  };

  // Carved in reverse so an earlier, more specific area (the camp gate patch inside
  // the forest) is written last and wins its own tiles.
  for (const area of [...AREA_LIST].reverse()) carve(area.rect, area.ground);
  for (const corridor of CORRIDORS) carve(corridor.rect, corridor.ground);

  blendGroundSeams(kinds, new Rng(subSeed(seed, 'blend')));

  const tiles: number[][] = [];
  for (let y = 0; y < rows; y++) {
    const row = new Array<number>(cols).fill(TILE.CLIFF);
    for (let x = 0; x < cols; x++) {
      const kind = kinds[y][x];
      if (kind) row[x] = rng.pick(GROUND_TILES[kind] ?? GROUND_TILES.snow);
    }
    tiles.push(row);
  }

  // The one visual tell for the secret: glossy ice on the lake side of the cracked patch.
  const secretGate = GATES.secretIce.rect;
  for (let y = secretGate.y0 - 1; y < secretGate.y1 + 1; y++) {
    for (let x = secretGate.x0 - 3; x < secretGate.x0; x++) {
      if (inBounds(x, y) && !isSolidIndex(tiles[y][x])) tiles[y][x] = TILE.ICE_GLOSS;
    }
  }

  // Gates are solid tiles until they are opened.
  const gateTiles = {} as Record<GateId, Array<{ x: number; y: number }>>;
  for (const id of GATE_IDS) {
    const def = GATES[id];
    const list: Array<{ x: number; y: number }> = [];
    for (let y = def.rect.y0; y < def.rect.y1; y++) {
      for (let x = def.rect.x0; x < def.rect.x1; x++) {
        if (!inBounds(x, y)) continue;
        tiles[y][x] = GATE_TILE[id];
        list.push({ x, y });
      }
    }
    gateTiles[id] = list;
  }

  // Cliffs with walkable ground below them get a snow cap, so walls read as walls.
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols; x++) {
      if (tiles[y][x] === TILE.CLIFF && !isSolidIndex(tiles[y + 1][x])) {
        tiles[y][x] = TILE.CLIFF_TOP;
      }
    }
  }

  const props = placeProps(tiles, seed);
  const decor = placeDecor(tiles, seed, props);
  return { tiles, kinds, props, decor, gateTiles, walkable: walkableBounds(tiles) };
}

/** The bounding box of everything that is not solid, in pixels. */
function walkableBounds(tiles: number[][]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX: number = cols;
  let minY: number = rows;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (isSolidIndex(tiles[y][x])) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const t = TILE_PX;
  return {
    x: minX * t,
    y: minY * t,
    width: (maxX - minX + 1) * t,
    height: (maxY - minY + 1) * t,
  };
}

/**
 * Things to look at. The world was readable but bare: trees, rocks, wrecks and
 * nothing else. These are scattered thickly because none of them cost anything to
 * walk through, and a landscape with litter in it feels lived in.
 */
function placeDecor(tiles: number[][], seed: number, props: PropPlacement[]): DecorPlacement[] {
  const out: DecorPlacement[] = [];
  const taken = new Set(props.map((p) => `${p.tx},${p.ty}`));

  for (const area of AREA_LIST) {
    const rng = new Rng(subSeed(seed, `decor:${area.id}`));
    const tilesInArea = (area.rect.x1 - area.rect.x0) * (area.rect.y1 - area.rect.y0);

    const table = DECOR_TABLE[area.id];

    const count = Math.round((tilesInArea / 100) * 7);
    for (let i = 0; i < count; i++) {
      const tx = rng.int(area.rect.x0 + 1, area.rect.x1 - 2);
      const ty = rng.int(area.rect.y0 + 1, area.rect.y1 - 2);
      const key = `${tx},${ty}`;
      if (taken.has(key)) continue;
      if (!inBounds(tx, ty) || isSolidIndex(tiles[ty][tx])) continue;
      if (isReserved(tx, ty)) continue;
      taken.add(key);
      out.push({ kind: rng.pick(table), tx, ty, area: area.id });
    }
  }

  return out;
}

/**
 * Soften the joins between areas.
 *
 * A dither alone still reads as a straight line with noise sprinkled on it, so the
 * boundary is first pushed around by smooth waves and only then dithered. The result is
 * a floor that wanders across the seam, which is what makes walking from snow onto ice
 * feel like a place changing rather than a tile index changing.
 *
 * This only ever changes which ground a walkable tile shows. It cannot make a tile
 * walkable or unwalkable, so it can never alter how the map is connected.
 */
function blendGroundSeams(kinds: Array<Array<string | null>>, rng: Rng): void {
  const REACH = 3;
  const source = kinds.map((row) => row.slice());

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const mine = source[y][x];
      if (!mine) continue;

      // Nearest tile of a different kind, and how far off it is.
      let foundKind: string | null = null;
      let foundDist = REACH + 1;

      for (let dy = -REACH; dy <= REACH; dy++) {
        for (let dx = -REACH; dx <= REACH; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const other = source[ny][nx];
          if (!other || other === mine) continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist < foundDist) {
            foundDist = dist;
            foundKind = other;
          }
        }
      }

      if (!foundKind) continue;

      // Three waves at different frequencies, so the edge wanders without repeating.
      // No random scatter: a coherent wave keeps the blended ground contiguous, where
      // a dice roll left single dark road tiles stranded out in the snow looking like
      // a bug.
      const wave =
        Math.sin(x * 0.55) * 1.3 +
        Math.sin(y * 0.41) * 1.3 +
        Math.sin((x + y) * 0.17) * 1.0 +
        Math.sin((x - y) * 0.27) * 0.7;

      if (foundDist <= wave) kinds[y][x] = foundKind;
    }
  }

  void rng;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

export function isSolidIndex(index: number): boolean {
  return (
    index === TILE.CLIFF ||
    index === TILE.CLIFF_TOP ||
    index === TILE.GATE_SNOW ||
    index === TILE.GATE_ICE ||
    index === TILE.GATE_BLUE
  );
}

/** Keep corridors, the spawn and the area seams clear so nothing can wall the player in. */
function isReserved(tx: number, ty: number): boolean {
  if (Math.abs(tx - WORLD_SPAWN.x) < 4 && Math.abs(ty - WORLD_SPAWN.y) < 4) return true;
  for (const c of CORRIDORS) {
    if (
      tx >= c.rect.x0 - 2 &&
      tx < c.rect.x1 + 2 &&
      ty >= c.rect.y0 - 2 &&
      ty < c.rect.y1 + 2
    ) {
      return true;
    }
  }
  return false;
}

function placeProps(tiles: number[][], seed: number): PropPlacement[] {
  const out: PropPlacement[] = [];
  const taken = new Set<string>();

  for (const area of AREA_LIST) {
    const rng = new Rng(subSeed(seed, `props:${area.id}`));
    const w = area.rect.x1 - area.rect.x0;
    const h = area.rect.y1 - area.rect.y0;
    const tilesInArea = w * h;

    const clusterCount = Math.max(2, Math.round(tilesInArea / 130));
    const clusters = Array.from({ length: clusterCount }, () => ({
      x: rng.int(area.rect.x0 + 3, area.rect.x1 - 4),
      y: rng.int(area.rect.y0 + 3, area.rect.y1 - 4),
    }));

    const budget: Array<[PropKind, number]> = [
      ['pine', Math.round((area.scenery.trees * tilesInArea) / 100)],
      ['rock', Math.round((area.scenery.rocks * tilesInArea) / 100)],
      ['wreck', Math.round((area.scenery.wrecks * tilesInArea) / 100)],
      ['crystal', Math.round((area.scenery.crystals * tilesInArea) / 100)],
    ];

    for (const [kind, count] of budget) {
      for (let i = 0; i < count; i++) {
        const spot = findSpot(tiles, area, rng, taken, clusters);
        if (!spot) continue;
        taken.add(`${spot.tx},${spot.ty}`);
        out.push({ kind: varyKind(kind, rng), tx: spot.tx, ty: spot.ty, area: area.id });
      }
    }

    // A few bushes everywhere, so food is never impossible to find.
    const bushes = Math.max(2, Math.round(tilesInArea / 90));
    for (let i = 0; i < bushes; i++) {
      const spot = findSpot(tiles, area, rng, taken);
      if (!spot) continue;
      taken.add(`${spot.tx},${spot.ty}`);
      out.push({ kind: 'bush', tx: spot.tx, ty: spot.ty, area: area.id });
    }
  }

  return out;
}

/** Break up the silhouette so a forest is not a grid of identical trees. */
function varyKind(kind: PropKind, rng: Rng): PropKind {
  if (kind === 'pine') {
    const roll = rng.next();
    if (roll < 0.18) return 'deadTree';
    if (roll < 0.42) return 'pineSmall';
    return 'pine';
  }
  if (kind === 'rock') return rng.chance(0.45) ? 'rockSmall' : 'rock';
  return kind;
}

function findSpot(
  tiles: number[][],
  area: AreaDef,
  rng: Rng,
  taken: Set<string>,
  clusters?: Array<{ x: number; y: number }>,
): { tx: number; ty: number } | null {
  for (let attempt = 0; attempt < 24; attempt++) {
    let tx: number;
    let ty: number;
    // Most props gather near a cluster centre, so the map has thickets and clearings
    // rather than an even sprinkle.
    if (clusters && clusters.length > 0 && rng.chance(0.78)) {
      const c = rng.pick(clusters);
      tx = Math.round(c.x + rng.range(-4.5, 4.5));
      ty = Math.round(c.y + rng.range(-3.5, 3.5));
      if (tx < area.rect.x0 + 1 || tx > area.rect.x1 - 2) continue;
      if (ty < area.rect.y0 + 1 || ty > area.rect.y1 - 2) continue;
    } else {
      tx = rng.int(area.rect.x0 + 1, area.rect.x1 - 2);
      ty = rng.int(area.rect.y0 + 1, area.rect.y1 - 2);
    }
    if (!inBounds(tx, ty)) continue;
    if (taken.has(`${tx},${ty}`)) continue;
    if (isSolidIndex(tiles[ty][tx])) continue;
    if (isReserved(tx, ty)) continue;
    if (!rectContains(area.rect, tx, ty)) continue;
    // Leave a gap around each prop so the world never becomes impassable.
    let crowded = false;
    for (let dy = -2; dy <= 2 && !crowded; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (taken.has(`${tx + dx},${ty + dy}`)) {
          crowded = true;
          break;
        }
      }
    }
    if (crowded) continue;
    return { tx, ty };
  }
  return null;
}
