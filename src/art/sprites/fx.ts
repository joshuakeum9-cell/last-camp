import Phaser from 'phaser';
import { PixelFactory } from '../PixelFactory';
import { PAL } from '../palette';

/** Texture keys for particles, glows and overlays. */
export const FX = {
  dot1: 'fx-dot1',
  dot2: 'fx-dot2',
  dot3: 'fx-dot3',
  streak: 'fx-streak',
  spark: 'fx-spark',
  glowSmall: 'fx-glow-sm',
  glowMed: 'fx-glow-md',
  glowLarge: 'fx-glow-lg',
  glowHuge: 'fx-glow-xl',
  ring: 'fx-ring',
  white: 'fx-white',
  puff: 'fx-puff',
} as const;

export function buildFx(scene: Phaser.Scene): void {
  PixelFactory.makeRect(scene, FX.dot1, 1, 1, PAL.white);
  PixelFactory.makeRect(scene, FX.dot2, 2, 2, PAL.white);
  PixelFactory.makeRect(scene, FX.dot3, 3, 3, PAL.white);
  PixelFactory.makeRect(scene, FX.streak, 6, 1, PAL.white);
  PixelFactory.makeRect(scene, FX.white, 8, 8, PAL.white);

  // A 3x3 plus sign reads as an impact spark at this scale.
  PixelFactory.makeTexture(scene, FX.spark, ['.w.', 'www', '.w.'], { '.': null, w: 'white' });

  // A little snow puff for footsteps and landings.
  PixelFactory.makeTexture(
    scene,
    FX.puff,
    ['.ww.', 'wwww', 'wwww', '.ww.'],
    { '.': null, w: 'white' },
  );

  PixelFactory.makeGlow(scene, FX.glowSmall, 24, PAL.white);
  PixelFactory.makeGlow(scene, FX.glowMed, 64, PAL.white);
  PixelFactory.makeGlow(scene, FX.glowLarge, 160, PAL.white);
  PixelFactory.makeGlow(scene, FX.glowHuge, 320, PAL.white);

  // Hollow ring for telegraphs and perfect dodges.
  PixelFactory.makeCanvas(scene, FX.ring, 64, 64, (ctx) => {
    ctx.strokeStyle = PAL.white;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.stroke();
  });
}
