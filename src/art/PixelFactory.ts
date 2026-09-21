import Phaser from 'phaser';
import { color } from './palette';

/**
 * Turns pixel maps written as strings into Phaser textures and animations, so the game
 * ships with no image files. One texture per sprite holds every frame in a row.
 *
 *   const rat: PixelSprite = {
 *     key: 'rat', fps: 8,
 *     palette: { '.': null, 'g': 'grey', 'p': 'blood' },
 *     anims: { idle: [[ '.gg.', 'gppg' ]] },
 *   };
 */
export interface PixelSprite {
  key: string;
  fps?: number;
  /** Character -> palette name, '#rrggbb', or null for transparent. */
  palette: Record<string, string | null>;
  /** Animation name -> frames -> rows of characters. */
  anims: Record<string, string[][]>;
  /** Animations that should play once instead of looping. */
  once?: string[];
  /** Per-animation frame rate override. */
  fpsOverride?: Record<string, number>;
}

export interface BuiltSprite {
  key: string;
  width: number;
  height: number;
  anims: string[];
}

const built = new Map<string, BuiltSprite>();

export const PixelFactory = {
  /** Build (or return the cached) texture and animations for a sprite. */
  build(scene: Phaser.Scene, sprite: PixelSprite): BuiltSprite {
    const cached = built.get(sprite.key);
    if (cached && scene.textures.exists(sprite.key)) {
      ensureAnims(scene, sprite, cached);
      return cached;
    }

    const frames: { name: string; rows: string[] }[] = [];
    for (const [animName, animFrames] of Object.entries(sprite.anims)) {
      animFrames.forEach((rows, i) => frames.push({ name: `${animName}_${i}`, rows }));
    }
    if (frames.length === 0) throw new Error(`[PixelFactory] "${sprite.key}" has no frames`);

    let w = 0;
    let h = 0;
    for (const f of frames) {
      h = Math.max(h, f.rows.length);
      for (const row of f.rows) w = Math.max(w, row.length);
    }

    const tex = scene.textures.createCanvas(sprite.key, w * frames.length, h);
    if (!tex) throw new Error(`[PixelFactory] could not create canvas for "${sprite.key}"`);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;

    frames.forEach((f, i) => {
      drawRows(ctx, f.rows, sprite.palette, i * w, 0, sprite.key);
      tex.add(f.name, 0, i * w, 0, w, h);
    });
    tex.refresh();

    const info: BuiltSprite = { key: sprite.key, width: w, height: h, anims: Object.keys(sprite.anims) };
    built.set(sprite.key, info);
    ensureAnims(scene, sprite, info);
    return info;
  },

  /** Draw pixel rows straight onto a fresh texture, with no animation. */
  makeTexture(
    scene: Phaser.Scene,
    key: string,
    rows: string[],
    palette: Record<string, string | null>,
  ): void {
    if (scene.textures.exists(key)) return;
    const h = rows.length;
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    drawRows(ctx, rows, palette, 0, 0, key);
    tex.refresh();
  },

  /** A plain filled rectangle texture, handy for bars, glows and particles. */
  makeRect(scene: Phaser.Scene, key: string, w: number, h: number, fill: string): void {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.fillStyle = color(fill);
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
  },

  /** A soft radial dot, used for glows, lights and snow. */
  makeGlow(scene: Phaser.Scene, key: string, size: number, fill: string, softness = 1): void {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    const c = color(fill);
    g.addColorStop(0, hexToRgba(c, 1));
    g.addColorStop(Math.max(0.01, 0.5 / softness), hexToRgba(c, 0.45));
    g.addColorStop(1, hexToRgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  },

  /** Run a raw canvas drawing function into a named texture. Used by the tileset builder. */
  makeCanvas(
    scene: Phaser.Scene,
    key: string,
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): Phaser.Textures.CanvasTexture | null {
    if (scene.textures.exists(key)) return scene.textures.get(key) as Phaser.Textures.CanvasTexture;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return null;
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    tex.refresh();
    return tex;
  },

  /** Forget everything, so a hot reload rebuilds cleanly. */
  clearCache(): void {
    built.clear();
  },
};

function ensureAnims(scene: Phaser.Scene, sprite: PixelSprite, info: BuiltSprite): void {
  for (const [animName, animFrames] of Object.entries(sprite.anims)) {
    const key = `${sprite.key}_${animName}`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: animFrames.map((_, i) => ({ key: sprite.key, frame: `${animName}_${i}` })),
      frameRate: sprite.fpsOverride?.[animName] ?? sprite.fps ?? 8,
      repeat: sprite.once?.includes(animName) ? 0 : -1,
    });
  }
  void info;
}

function drawRows(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  palette: Record<string, string | null>,
  ox: number,
  oy: number,
  keyForWarning: string,
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const named = palette[ch];
      if (named === undefined) {
        if (ch !== ' ' && ch !== '.') {
          console.warn(`[PixelFactory] "${keyForWarning}" has no palette entry for "${ch}"`);
        }
        continue;
      }
      if (named === null) continue;
      ctx.fillStyle = color(named);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function hexToRgba(hexColor: string, alpha: number): string {
  const n = parseInt(hexColor.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Replace the last `legs.length` rows of a body with a leg pattern. Keeps walk cycles
 * short to write: one body, a few leg poses.
 */
export function withLegs(body: string[], legs: string[]): string[] {
  return [...body.slice(0, body.length - legs.length), ...legs];
}

/** Shift every row horizontally by dx, padding with '.', for a simple bob or lean. */
export function shift(rows: string[], dx: number): string[] {
  if (dx === 0) return rows;
  return rows.map((r) => {
    if (dx > 0) return '.'.repeat(dx) + r.slice(0, Math.max(0, r.length - dx));
    return r.slice(-dx) + '.'.repeat(-dx);
  });
}

/** Push rows down by dy, for an idle breathe. */
export function bob(rows: string[], dy: number): string[] {
  if (dy <= 0) return rows;
  const width = rows[0]?.length ?? 0;
  return [...Array.from({ length: dy }, () => '.'.repeat(width)), ...rows.slice(0, rows.length - dy)];
}
