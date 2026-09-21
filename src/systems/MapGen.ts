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

export interface WorldMapData {
  tiles: number[][];
  props: PropPlacement[];
  /** Tiles belonging to each gate, so opening one can clear them. */
  gateTiles: Record<GateId, Array<{ x: number; y: number }>>;
}

const { cols, rows } = BAL.world;

/** Props that block movement, used by WorldScene to add static bodies. */
export const SOLID_PROPS: PropKind[] = ['pine', 'deadTree', 'rock', 'wreck', 'crystal'];

/**
 * Build the whole wilderness from the area rectangles. Everything starts as cliff and the
 * areas and corridors are carved out of it, which guarantees the map is exactly as connected
 * as data/areas.ts says it is.
 */
export function generateWorld(seed: number): WorldMapData {
  const rng = new Rng(subSeed(seed, 'world'));
  const tiles: number[][] = [];
  for (let y = 0; y < rows; y++) {
    tiles.push(new Array<number>(cols).fill(TILE.CLIFF));
  }

  const carve = (rect: Rect, ground: string, r: Rng) => {
    const variants = GROUND_TILES[ground] ?? GROUND_TILES.snow;
    for (let y = Math.max(0, rect.y0); y < Math.min(rows, rect.y1); y++) {
      for (let x = Math.max(0, rect.x0); x < Math.min(cols, rect.x1); x++) {
        tiles[y][x] = r.pick(variants);
      }
    }
  };

  for (const area of AREA_LIST) carve(area.rect, area.ground, rng);
  for (const corridor of CORRIDORS) carve(corridor.rect, corridor.ground, rng);

  // The one visual tell for the secret: glossy ice on the lake side of the cracked patch.
  const secretGate = GATES.secretIce.rect;
  for (let y = secretGate.y0 - 1; y < secretGate.y1 + 1; y++) {
    for (let x = secretGate.x0 - 3; x < secretGate.x0; x++) {
      if (inBounds(x, y)) tiles[y][x] = TILE.ICE_GLOSS;
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
  return { tiles, props, gateTiles };
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

function isSolidIndex(index: number): boolean {
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
