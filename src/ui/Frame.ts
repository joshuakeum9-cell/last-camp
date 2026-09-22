import Phaser from 'phaser';
import { hex, PAL } from '../art/palette';

export interface FrameOptions {
  fill?: string;
  alpha?: number;
  /** The one-pixel outline. Gold for things that talk to you, black for the HUD. */
  edge?: string;
  /** Top and left inner line, the lit side. */
  light?: string;
  /** Bottom and right inner line, the shadowed side. */
  dark?: string;
}

/**
 * The one panel style, drawn everywhere a panel is drawn.
 *
 * A flat rectangle with a thin stroke reads as a placeholder. What the games this
 * one learns from (Stardew, Terraria, Dead Cells) do is give every panel the same
 * two-tone bevel: a lit edge on the top and left, a shadowed edge on the bottom and
 * right, and a corner pixel knocked off so the box looks cut rather than drawn.
 * Once every panel shares that, the whole interface reads as one piece of kit.
 */
export function drawFrame(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: FrameOptions = {},
): void {
  const fill = hex(opts.fill ?? PAL.navy);
  const alpha = opts.alpha ?? 0.92;
  const edge = hex(opts.edge ?? PAL.black);
  const light = hex(opts.light ?? PAL.blueDark);
  const dark = hex(opts.dark ?? PAL.black);
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);

  g.clear();
  // Outline, with the four corner pixels left out.
  g.fillStyle(edge, 1);
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  // Body.
  g.fillStyle(fill, alpha);
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Lit edge, top and left.
  g.fillStyle(light, 0.75);
  g.fillRect(x + 2, y + 1, w - 4, 1);
  g.fillRect(x + 1, y + 2, 1, h - 4);
  // Shadowed edge, bottom and right.
  g.fillStyle(dark, 0.55);
  g.fillRect(x + 2, y + h - 2, w - 4, 1);
  g.fillRect(x + w - 2, y + 2, 1, h - 4);
}

/** A new Graphics object with a frame already on it. */
export function makeFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: FrameOptions = {},
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawFrame(g, x, y, w, h, opts);
  return g;
}
