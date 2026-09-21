import Phaser from 'phaser';
import { PAL } from '../palette';
import { PixelFactory } from '../PixelFactory';
import { Rng } from '../../core/Rng';

/** Tile indices in the generated tileset. Order here is the order drawn below. */
export const TILE = {
  SNOW_A: 0,
  SNOW_B: 1,
  SNOW_C: 2,
  DEEP_A: 3,
  DEEP_B: 4,
  ROAD_A: 5,
  ROAD_B: 6,
  ROAD_EDGE: 7,
  ICE_A: 8,
  ICE_B: 9,
  ICE_CRACK: 10,
  FLOOR_A: 11,
  FLOOR_B: 12,
  CAMP_A: 13,
  CAMP_B: 14,
  ICE_GLOSS: 15,
  CLIFF: 16,
  CLIFF_TOP: 17,
  GATE_SNOW: 18,
  GATE_ICE: 19,
  GATE_BLUE: 20,
} as const;

export const TILESET_KEY = 'tileset';
export const TILE_COUNT = 21;
export const TILE_SIZE = 16;

/** Tiles the player and enemies cannot walk through. */
export const SOLID_TILES: number[] = [
  TILE.CLIFF,
  TILE.CLIFF_TOP,
  TILE.GATE_SNOW,
  TILE.GATE_ICE,
  TILE.GATE_BLUE,
];

type Draw = (ctx: CanvasRenderingContext2D, ox: number, rng: Rng) => void;

function fill(ctx: CanvasRenderingContext2D, ox: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(ox, 0, TILE_SIZE, TILE_SIZE);
}

function speckle(ctx: CanvasRenderingContext2D, ox: number, rng: Rng, c: string, n: number): void {
  ctx.fillStyle = c;
  for (let i = 0; i < n; i++) {
    ctx.fillRect(ox + rng.int(0, TILE_SIZE - 1), rng.int(0, TILE_SIZE - 1), 1, 1);
  }
}

function streak(
  ctx: CanvasRenderingContext2D,
  ox: number,
  rng: Rng,
  c: string,
  n: number,
  maxLen = 5,
): void {
  ctx.fillStyle = c;
  for (let i = 0; i < n; i++) {
    const x = rng.int(0, TILE_SIZE - 2);
    const y = rng.int(0, TILE_SIZE - 1);
    const len = rng.int(2, maxLen);
    ctx.fillRect(ox + x, y, Math.min(len, TILE_SIZE - x), 1);
  }
}

const snow: Draw = (ctx, ox, rng) => {
  fill(ctx, ox, '#cfe6ff');
  speckle(ctx, ox, rng, PAL.white, 12);
  speckle(ctx, ox, rng, PAL.snow, 10);
  speckle(ctx, ox, rng, PAL.snowShade, 10);
  streak(ctx, ox, rng, '#a7ccf5', 2, 6);
};

const deep: Draw = (ctx, ox, rng) => {
  fill(ctx, ox, '#b9ddff');
  streak(ctx, ox, rng, PAL.snowShade, 5, 8);
  streak(ctx, ox, rng, '#5aa0f0', 2, 6);
  speckle(ctx, ox, rng, PAL.white, 8);
};

const road: Draw = (ctx, ox, rng) => {
  fill(ctx, ox, '#2f2a72');
  speckle(ctx, ox, rng, '#443ca0', 16);
  streak(ctx, ox, rng, '#1a1550', 3, 8);
  // wind-blown snow caught on the tarmac
  speckle(ctx, ox, rng, PAL.snow, 10);
  speckle(ctx, ox, rng, PAL.violet, 3);
};

const ice: Draw = (ctx, ox, rng) => {
  fill(ctx, ox, '#5fdcff');
  streak(ctx, ox, rng, '#b4f4ff', 4, 9);
  streak(ctx, ox, rng, '#1c8ed8', 3, 6);
  speckle(ctx, ox, rng, PAL.white, 6);
};

/**
 * Snow too deep to wade into. This is everywhere the player cannot walk.
 *
 * It was a green treeline, and before that a flat blue wall, and both read as a
 * border drawn around the level rather than as part of the world. Deep drifted
 * snow is the same material as the ground beside it, just piled higher, so the
 * edge of the map stops announcing itself.
 */
const deepDrift: Draw = (ctx, ox, rng) => {
  fill(ctx, ox, '#f2f8ff');

  // Wind-packed ridges running across the drift.
  for (let i = 0; i < 4; i++) {
    const y = rng.int(0, TILE_SIZE - 1);
    const len = rng.int(6, TILE_SIZE);
    const x = rng.int(0, TILE_SIZE - 3);
    ctx.fillStyle = '#d3e6fb';
    ctx.fillRect(ox + x, y, Math.min(len, TILE_SIZE - x), 1);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(ox + x, y - 1, Math.min(len, TILE_SIZE - x), 1);
  }

  speckle(ctx, ox, rng, PAL.white, 12);
  speckle(ctx, ox, rng, '#bcd6f2', 8);
  speckle(ctx, ox, rng, PAL.cyan, 2);
};

const TILE_DRAW: Draw[] = [
  // SNOW_A / B / C
  snow,
  (ctx, ox, rng) => {
    snow(ctx, ox, rng);
    speckle(ctx, ox, rng, PAL.snowShade, 10);
  },
  (ctx, ox, rng) => {
    snow(ctx, ox, rng);
    streak(ctx, ox, rng, PAL.white, 4, 7);
    speckle(ctx, ox, rng, PAL.cyan, 4);
  },

  // DEEP_A / B
  deep,
  (ctx, ox, rng) => {
    deep(ctx, ox, rng);
    streak(ctx, ox, rng, '#8fc6ff', 4, 9);
  },

  // ROAD_A / B / EDGE
  road,
  (ctx, ox, rng) => {
    road(ctx, ox, rng);
    // faded centre line
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(ox + 7, 2, 2, 5);
    ctx.fillRect(ox + 7, 10, 2, 5);
  },
  (ctx, ox, rng) => {
    road(ctx, ox, rng);
    ctx.fillStyle = PAL.snow;
    ctx.fillRect(ox, 0, TILE_SIZE, 4);
    ctx.fillStyle = PAL.snowShade;
    ctx.fillRect(ox, 4, TILE_SIZE, 1);
    speckle(ctx, ox, rng, PAL.white, 5);
  },

  // ICE_A / B / CRACK
  ice,
  (ctx, ox, rng) => {
    ice(ctx, ox, rng);
    speckle(ctx, ox, rng, PAL.snow, 12);
  },
  (ctx, ox, rng) => {
    ice(ctx, ox, rng);
    ctx.fillStyle = '#0f6fc0';
    ctx.fillRect(ox + 2, 8, 6, 1);
    ctx.fillRect(ox + 7, 5, 1, 4);
    ctx.fillRect(ox + 8, 9, 5, 1);
    ctx.fillRect(ox + 4, 9, 1, 4);
  },

  // FLOOR_A / B (cabin boards)
  (ctx, ox, rng) => {
    fill(ctx, ox, PAL.wood);
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(ox, 5, TILE_SIZE, 1);
    ctx.fillRect(ox, 11, TILE_SIZE, 1);
    speckle(ctx, ox, rng, PAL.bark, 6);
    speckle(ctx, ox, rng, '#d4813a', 5);
  },
  (ctx, ox, rng) => {
    fill(ctx, ox, '#98511a');
    ctx.fillStyle = PAL.woodDark;
    ctx.fillRect(ox, 3, TILE_SIZE, 1);
    ctx.fillRect(ox, 9, TILE_SIZE, 1);
    ctx.fillRect(ox + 6, 9, 1, 7);
    speckle(ctx, ox, rng, PAL.bark, 8);
  },

  // CAMP_A / B: snow packed down by boots. The warmth comes from the firelight.
  (ctx, ox, rng) => {
    fill(ctx, ox, '#eaeff7');
    speckle(ctx, ox, rng, '#ccd6e6', 14);
    speckle(ctx, ox, rng, PAL.cream, 6);
    speckle(ctx, ox, rng, PAL.white, 5);
  },
  (ctx, ox, rng) => {
    fill(ctx, ox, '#dfe4ee');
    speckle(ctx, ox, rng, '#b6aa96', 12);
    speckle(ctx, ox, rng, '#8d7f68', 5);
    speckle(ctx, ox, rng, PAL.cream, 5);
  },

  // ICE_GLOSS: the only visual tell for the secret. Darker, glassier, faintly humming.
  (ctx, ox, rng) => {
    fill(ctx, ox, '#1f5ad4');
    streak(ctx, ox, rng, PAL.ice, 5, 10);
    streak(ctx, ox, rng, '#10327f', 3, 8);
    ctx.fillStyle = PAL.cyan;
    ctx.fillRect(ox + 3, 4, 9, 1);
    ctx.fillRect(ox + 6, 11, 7, 1);
  },

  // CLIFF: snow too deep to walk into.
  deepDrift,

  // CLIFF_TOP: the face of the drift where it meets walkable ground. A soft
  // shadowed lip, so the edge is legible without being a drawn line.
  (ctx, ox, rng) => {
    deepDrift(ctx, ox, rng);
    ctx.fillStyle = '#c3d9f4';
    ctx.fillRect(ox, 12, TILE_SIZE, 2);
    ctx.fillStyle = '#a8c6ea';
    ctx.fillRect(ox, 14, TILE_SIZE, 1);
    ctx.fillStyle = '#8fb4e0';
    ctx.fillRect(ox, 15, TILE_SIZE, 1);
    speckle(ctx, ox, rng, PAL.white, 5);
  },

  // GATE_SNOW: a packed drift you can break through
  (ctx, ox, rng) => {
    fill(ctx, ox, '#f2f9ff');
    ctx.fillStyle = PAL.snowShade;
    for (let y = 1; y < TILE_SIZE; y += 4) ctx.fillRect(ox, y, TILE_SIZE, 1);
    speckle(ctx, ox, rng, PAL.white, 12);
    speckle(ctx, ox, rng, PAL.cyan, 3);
  },

  // GATE_ICE: thin glassy ice over the hollow
  (ctx, ox, rng) => {
    fill(ctx, ox, '#6fe0ff');
    streak(ctx, ox, rng, PAL.white, 5, 9);
    ctx.fillStyle = '#1478bd';
    ctx.fillRect(ox + 1, 7, 13, 1);
    ctx.fillRect(ox + 8, 2, 1, 12);
  },

  // GATE_BLUE: the tower pass. Nothing you carry will cut it.
  (ctx, ox, rng) => {
    fill(ctx, ox, PAL.blue);
    streak(ctx, ox, rng, PAL.cyan, 5, 11);
    streak(ctx, ox, rng, PAL.violet, 3, 8);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(ox + 4, 1, 1, 14);
    ctx.fillRect(ox + 10, 2, 1, 12);
  },
];

/** Build the tileset texture. Deterministic, so the world looks the same every load. */
export function buildTileset(scene: Phaser.Scene): void {
  PixelFactory.makeCanvas(scene, TILESET_KEY, TILE_COUNT * TILE_SIZE, TILE_SIZE, (ctx) => {
    const rng = new Rng(0x5eed1ce);
    TILE_DRAW.forEach((draw, i) => draw(ctx, i * TILE_SIZE, rng));
  });
}

/** Ground kind -> the tile variants MapGen may pick from. */
export const GROUND_TILES: Record<string, number[]> = {
  snow: [TILE.SNOW_A, TILE.SNOW_A, TILE.SNOW_B, TILE.SNOW_C],
  deep: [TILE.DEEP_A, TILE.DEEP_A, TILE.DEEP_B],
  road: [TILE.ROAD_A, TILE.ROAD_A, TILE.ROAD_A, TILE.ROAD_B, TILE.ROAD_EDGE],
  ice: [TILE.ICE_A, TILE.ICE_A, TILE.ICE_B, TILE.ICE_CRACK],
  floor: [TILE.FLOOR_A, TILE.FLOOR_B],
  camp: [TILE.CAMP_A, TILE.CAMP_A, TILE.CAMP_B],
};

export const GATE_TILE: Record<string, number> = {
  bossSnowbank: TILE.GATE_SNOW,
  secretIce: TILE.GATE_ICE,
  towerIce: TILE.GATE_BLUE,
};
