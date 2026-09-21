import Phaser from 'phaser';
import { Rng, hashString } from '../../core/Rng';
import { GROUND_TILES, TILE, TILE_COUNT, TILE_DRAW, TILE_SIZE } from './tiles';

/**
 * Pixel-level ground transitions.
 *
 * A tile used to be entirely one ground. However wavy the seam between two areas was
 * made at the tile level, every individual tile still met its neighbour along a hard
 * one-pixel edge, and that is what made the map look like it was built from squares.
 *
 * This builds, for every tile that borders a different ground, a bespoke tile that
 * feathers the neighbour's ground into it across about half the tile, with dithered
 * noise so the edge is soft rather than a straight gradient. The result is a seam
 * that is smooth at the pixel level, in whichever directions the neighbours happen
 * to be.
 *
 * Every map builds its own tileset from a TilesetBuilder, because the set of
 * transitions a map needs depends on which grounds it puts next to each other.
 */

/** Neighbour bits, clockwise from north. */
const N = 1;
const NE = 2;
const E = 4;
const SE = 8;
const S = 16;
const SW = 32;
const W = 64;
const NW = 128;

/** How far into a tile the neighbour's ground reaches, in pixels. */
const FEATHER = 9;
/** Dither strength. Higher is rougher. */
const NOISE = 0.3;

type Draw = (ctx: CanvasRenderingContext2D, ox: number, rng: Rng) => void;

interface Transition {
  from: number;
  to: number;
  mask: number;
}

export class TilesetBuilder {
  private transitions: Transition[] = [];
  private index = new Map<string, number>();

  /**
   * Index of the tile that shows base tile `from` with base tile `to` feathered in
   * from the neighbours in `mask`. Registered on first request.
   */
  transition(from: number, to: number, mask: number): number {
    const key = `${from}:${to}:${mask}`;
    const existing = this.index.get(key);
    if (existing !== undefined) return existing;
    const idx = TILE_COUNT + this.transitions.length;
    this.transitions.push({ from, to, mask });
    this.index.set(key, idx);
    return idx;
  }

  get count(): number {
    return TILE_COUNT + this.transitions.length;
  }

  /** Render every base tile and every registered transition into one texture. */
  build(scene: Phaser.Scene, key: string): void {
    if (scene.textures.exists(key)) scene.textures.remove(key);

    const total = this.count;
    const tex = scene.textures.createCanvas(key, total * TILE_SIZE, TILE_SIZE);
    if (!tex) throw new Error('[TilesetBuilder] could not create the tileset canvas');
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;

    // Base tiles first, with the same seed as always so the world does not shimmer
    // between loads.
    const baseRng = new Rng(0x5eed1ce);
    TILE_DRAW.forEach((draw, i) => draw(ctx, i * TILE_SIZE, baseRng));

    // Scratch canvases for compositing a transition out of two base tiles.
    const scratchA = document.createElement('canvas');
    const scratchB = document.createElement('canvas');
    scratchA.width = scratchB.width = TILE_SIZE;
    scratchA.height = scratchB.height = TILE_SIZE;
    const ctxA = scratchA.getContext('2d')!;
    const ctxB = scratchB.getContext('2d')!;

    this.transitions.forEach((t, i) => {
      const ox = (TILE_COUNT + i) * TILE_SIZE;
      renderTransition(ctx, ox, t, ctxA, ctxB);
    });

    tex.refresh();
  }
}

function renderTransition(
  out: CanvasRenderingContext2D,
  ox: number,
  t: Transition,
  ctxA: CanvasRenderingContext2D,
  ctxB: CanvasRenderingContext2D,
): void {
  // Draw both grounds with a seed derived from their index, so a given transition
  // looks the same every time it is built.
  ctxA.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
  ctxB.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
  (TILE_DRAW[t.from] as Draw)(ctxA, 0, new Rng(0x1000 + t.from));
  (TILE_DRAW[t.to] as Draw)(ctxB, 0, new Rng(0x2000 + t.to));

  const a = ctxA.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const b = ctxB.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  const result = out.createImageData(TILE_SIZE, TILE_SIZE);

  const noise = new Rng(hashString(`${t.from}:${t.to}:${t.mask}`));

  for (let py = 0; py < TILE_SIZE; py++) {
    for (let px = 0; px < TILE_SIZE; px++) {
      const w = influence(t.mask, px, py) + (noise.next() - 0.5) * 2 * NOISE;
      const src = w > 0.5 ? b : a;
      const i = (py * TILE_SIZE + px) * 4;
      result.data[i] = src.data[i];
      result.data[i + 1] = src.data[i + 1];
      result.data[i + 2] = src.data[i + 2];
      result.data[i + 3] = 255;
    }
  }

  out.putImageData(result, ox, 0);
}

/**
 * How strongly the neighbour's ground wants this pixel, 0 to 1, taking the largest
 * pull from any neighbour that has it. Cardinal neighbours pull along an edge;
 * diagonal ones pull from a corner.
 */
function influence(mask: number, px: number, py: number): number {
  const edge = (dist: number) => Math.max(0, 1 - dist / FEATHER);
  const last = TILE_SIZE - 1;
  let w = 0;

  if (mask & N) w = Math.max(w, edge(py));
  if (mask & S) w = Math.max(w, edge(last - py));
  if (mask & W) w = Math.max(w, edge(px));
  if (mask & E) w = Math.max(w, edge(last - px));

  // Corners reach a little less far, so they read as a rounded bite rather than a
  // second full edge.
  const corner = (dx: number, dy: number) => Math.max(0, 1 - Math.hypot(dx, dy) / (FEATHER * 0.85));
  if (mask & NE) w = Math.max(w, corner(last - px, py));
  if (mask & NW) w = Math.max(w, corner(px, py));
  if (mask & SE) w = Math.max(w, corner(last - px, last - py));
  if (mask & SW) w = Math.max(w, corner(px, last - py));

  return w;
}

/**
 * Walk a kinds grid and replace every seam tile with a feathered one.
 *
 * `kinds[y][x]` is the ground name, or null where the tile is solid. Solid tiles are
 * treated as deep drift, so walkable ground feathers into the drifts too.
 *
 * This only ever changes what a walkable tile looks like. It never touches which
 * tiles are solid.
 */
export function applyTransitions(
  kinds: Array<Array<string | null>>,
  tiles: number[][],
  builder: TilesetBuilder,
  isSolid: (index: number) => boolean,
): void {
  const rows = kinds.length;
  const cols = kinds[0]?.length ?? 0;

  const kindAt = (x: number, y: number): string | null => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
    return kinds[y][x];
  };

  const dirs: Array<[number, number, number]> = [
    [0, -1, N],
    [1, -1, NE],
    [1, 0, E],
    [1, 1, SE],
    [0, 1, S],
    [-1, 1, SW],
    [-1, 0, W],
    [-1, -1, NW],
  ];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const mine = kinds[y][x];
      if (!mine) continue;
      if (isSolid(tiles[y][x])) continue;

      // Which different ground touches this tile, and from which sides. If more than
      // one does, the one touching the most sides wins.
      const masks = new Map<string, number>();
      for (const [dx, dy, bit] of dirs) {
        const other = kindAt(x + dx, y + dy) ?? '__drift';
        if (other === mine) continue;
        masks.set(other, (masks.get(other) ?? 0) | bit);
      }
      if (masks.size === 0) continue;

      let bestKind = '';
      let bestMask = 0;
      let bestBits = -1;
      for (const [kind, mask] of masks) {
        const bits = countBits(mask);
        if (bits > bestBits) {
          bestBits = bits;
          bestKind = kind;
          bestMask = mask;
        }
      }

      // Drifts are the base cliff tile; everything else is that ground's first variant.
      const toIndex = bestKind === '__drift' ? TILE.CLIFF : (GROUND_TILES[bestKind] ?? GROUND_TILES.snow)[0];
      tiles[y][x] = builder.transition(tiles[y][x], toIndex, bestMask);
    }
  }
}

function countBits(n: number): number {
  let c = 0;
  while (n) {
    c += n & 1;
    n >>= 1;
  }
  return c;
}
