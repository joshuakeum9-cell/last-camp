import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { hex, PAL } from '../art/palette';
import { FX } from '../art/sprites/fx';

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  /** 0..1. Lower values leave a dim halo rather than a clear hole. */
  strength?: number;
}

/**
 * Night. A full-screen navy wash with holes punched in it where there is light, so the
 * dark is a deep blue you can still see colour through rather than a black screen.
 *
 * Uses a RenderTexture and erase rather than a lighting pipeline, so it behaves the
 * same in WebGL and Canvas.
 */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Image;
  private lastUpdate = 0;
  private current = 0;

  constructor(
    private scene: Phaser.Scene,
    depth = 5010,
  ) {
    const { width, height } = BAL.view;
    this.rt = scene.add
      .renderTexture(0, 0, width, height)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(depth)
      .setVisible(false);

    // An off-screen brush, reused for every hole rather than allocating per light.
    this.brush = scene.add.image(-999, -999, FX.glowLarge).setVisible(false);
  }

  /**
   * @param darkness 0 is full daylight, 1 is the deepest night
   * @param lights   world-space light sources
   */
  update(time: number, darkness: number, lights: LightSource[]): void {
    // Ease toward the target so dusk arrives rather than switches on.
    this.current = Phaser.Math.Linear(this.current, darkness, 0.03);

    if (this.current < 0.02) {
      this.rt.setVisible(false);
      return;
    }
    this.rt.setVisible(true);

    const interval = 1000 / BAL.perf.darknessFps;
    if (time - this.lastUpdate < interval) return;
    this.lastUpdate = time;

    const cam = this.scene.cameras.main;
    this.rt.clear();
    this.rt.fill(hex(PAL.navy), this.current);

    for (const light of lights) {
      const sx = light.x - cam.scrollX;
      const sy = light.y - cam.scrollY;
      if (sx < -light.radius || sx > BAL.view.width + light.radius) continue;
      if (sy < -light.radius || sy > BAL.view.height + light.radius) continue;

      // The glow texture is 160px across; scale it to the light's radius.
      const scale = (light.radius * 2) / 160;
      this.brush.setPosition(sx, sy).setScale(scale).setAlpha(light.strength ?? 1);
      this.rt.erase(this.brush);
    }
  }

  setVisible(on: boolean): void {
    this.rt.setVisible(on);
  }

  destroy(): void {
    this.rt.destroy();
    this.brush.destroy();
  }
}
