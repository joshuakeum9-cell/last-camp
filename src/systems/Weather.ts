import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { hex, PAL } from '../art/palette';
import { FX } from '../art/sprites/fx';

/**
 * Snow, wind and fog. Everything is drawn in screen space so it costs the same no matter
 * how large the map is, and so it keeps falling while the camera moves.
 */
export class Weather {
  private far!: Phaser.GameObjects.Particles.ParticleEmitter;
  private near!: Phaser.GameObjects.Particles.ParticleEmitter;
  private wind!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fog: Phaser.GameObjects.TileSprite[] = [];
  private storm = false;
  private windX = -18;

  constructor(
    private scene: Phaser.Scene,
    private depth = 6000,
  ) {
    const { width, height } = BAL.view;

    this.far = scene.add.particles(0, 0, FX.dot1, {
      x: { min: -20, max: width + 20 },
      y: -6,
      lifespan: 6200,
      speedY: { min: 22, max: 38 },
      speedX: { min: -26, max: -8 },
      scale: 1,
      alpha: { min: 0.28, max: 0.5 },
      tint: hex(PAL.cyan),
      quantity: 1,
      frequency: 90,
      blendMode: Phaser.BlendModes.NORMAL,
    });

    this.near = scene.add.particles(0, 0, FX.dot2, {
      x: { min: -30, max: width + 30 },
      y: -8,
      lifespan: 3200,
      speedY: { min: 60, max: 110 },
      speedX: { min: -44, max: -14 },
      scale: { min: 0.8, max: 1.4 },
      alpha: { min: 0.55, max: 0.95 },
      tint: hex(PAL.white),
      quantity: 1,
      frequency: 60,
    });

    this.wind = scene.add.particles(0, 0, FX.streak, {
      x: width + 20,
      y: { min: 0, max: height },
      lifespan: 900,
      speedX: { min: -320, max: -190 },
      speedY: { min: -6, max: 10 },
      scaleX: { min: 1, max: 2.6 },
      scaleY: 1,
      alpha: { start: 0.42, end: 0 },
      tint: hex(PAL.white),
      quantity: 1,
      frequency: 420,
    });

    for (const emitter of [this.far, this.near, this.wind]) {
      emitter.setScrollFactor(0).setDepth(depth);
    }

    this.buildFog();
  }

  private buildFog(): void {
    const { width, height } = BAL.view;
    const key = 'fx-fog';
    if (!this.scene.textures.exists(key)) {
      const tex = this.scene.textures.createCanvas(key, 128, 64);
      if (tex) {
        const ctx = tex.getContext();
        for (let i = 0; i < 90; i++) {
          const x = Math.random() * 128;
          const y = Math.random() * 64;
          const r = 8 + Math.random() * 22;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, 'rgba(255,255,255,0.10)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        tex.refresh();
      }
    }
    for (let layer = 0; layer < 2; layer++) {
      const t = this.scene.add
        .tileSprite(0, 0, width, height, key)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(this.depth - 1 + layer)
        .setAlpha(0)
        .setTint(hex(layer === 0 ? PAL.cyan : PAL.white));
      this.fog.push(t);
    }
  }

  /** Called each frame by the scene. `darkness` comes from DayNightSystem. */
  update(dt: number, fogAmount: number): void {
    this.fog[0].tilePositionX += (this.windX * 0.6 * dt) / 1000;
    this.fog[1].tilePositionX += (this.windX * 1.4 * dt) / 1000;
    this.fog[1].tilePositionY += (4 * dt) / 1000;

    const target = Phaser.Math.Clamp(fogAmount, 0, 1);
    for (const f of this.fog) {
      f.setAlpha(Phaser.Math.Linear(f.alpha, target * (f === this.fog[0] ? 0.3 : 0.22), 0.04));
    }
  }

  /** Storms double the snow and make the wind constant. */
  setStorm(on: boolean): void {
    if (this.storm === on) return;
    this.storm = on;
    this.near.frequency = on ? 24 : 60;
    this.far.frequency = on ? 40 : 90;
    this.wind.frequency = on ? 90 : 420;
    this.windX = on ? -52 : -18;
  }

  /** Heavier snow at night, so the dark also looks colder. */
  setNight(amount: number): void {
    this.near.frequency = this.storm ? 24 : Math.round(60 - 22 * amount);
    this.far.setParticleTint(hex(amount > 0.4 ? PAL.ice : PAL.cyan));
  }

  setVisible(on: boolean): void {
    this.far.setVisible(on);
    this.near.setVisible(on);
    this.wind.setVisible(on);
    for (const f of this.fog) f.setVisible(on);
  }

  destroy(): void {
    this.far.destroy();
    this.near.destroy();
    this.wind.destroy();
    for (const f of this.fog) f.destroy();
    this.fog.length = 0;
  }
}
