import Phaser from 'phaser';
import { bus, Subscriptions } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL } from '../data/balance';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { FX } from '../art/sprites/fx';

/**
 * Screen shake, hitstop, flashes and floating numbers. Every effect reads the
 * accessibility settings, so a player can turn the game calm without losing information.
 */
export class Juice {
  private subs = new Subscriptions();
  private hitstopUntil = 0;
  private flashRect?: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene) {
    this.subs.add(bus.on('juice:shake', ({ intensity, ms }) => this.shake(intensity, ms)));
    this.subs.add(bus.on('juice:hitstop', ({ ms }) => this.hitstop(ms)));
    this.subs.add(bus.on('juice:flash', ({ color, ms }) => this.flash(color, ms)));
    scene.events.once('shutdown', () => this.destroy());
    scene.events.once('destroy', () => this.destroy());
  }

  /** Camera shake scaled by the player's shake setting. */
  shake(intensity: number, ms: number): void {
    const amount = intensity * state.settings.shake;
    if (amount <= 0.01) return;
    // Phaser's shake intensity is a fraction of the viewport, so convert from pixels.
    this.scene.cameras.main.shake(ms, amount / BAL.view.height, true);
  }

  /**
   * Freeze almost everything for a few milliseconds. This is what makes a hit land.
   * Overlapping calls extend rather than restart, so a flurry does not stack into a stall.
   */
  hitstop(ms: number): void {
    if (state.settings.shake <= 0) return;
    const now = this.scene.time.now;
    const until = now + ms;
    if (until <= this.hitstopUntil) return;
    this.hitstopUntil = until;

    this.scene.time.timeScale = BAL.combat.hitstopScale;
    if (this.scene.physics?.world) this.scene.physics.world.timeScale = 1 / BAL.combat.hitstopScale;
    this.scene.tweens.timeScale = BAL.combat.hitstopScale;

    // Use the real clock so the freeze ends even though the scene clock is slowed.
    this.scene.time.delayedCall(
      ms * BAL.combat.hitstopScale,
      () => {
        if (this.scene.time.now < this.hitstopUntil - 1) return;
        this.scene.time.timeScale = 1;
        if (this.scene.physics?.world) this.scene.physics.world.timeScale = 1;
        this.scene.tweens.timeScale = 1;
      },
      undefined,
      this,
    );
  }

  /** Full-screen colour flash. Suppressed when the player asks for reduced flashing. */
  flash(color = 0xffffff, ms = 90): void {
    if (state.settings.flashReduction) return;
    const cam = this.scene.cameras.main;
    if (!this.flashRect) {
      this.flashRect = this.scene.add
        .rectangle(0, 0, BAL.view.width, BAL.view.height, color)
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(9000);
    }
    this.flashRect.setFillStyle(color).setAlpha(0.55).setVisible(true);
    this.scene.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: ms,
      onComplete: () => this.flashRect?.setVisible(false),
    });
    void cam;
  }

  /** A damage number that rises and fades at a world position. */
  floatNumber(x: number, y: number, value: number, kind: 'normal' | 'crit' | 'burn' = 'normal'): void {
    const tint =
      kind === 'crit' ? hex(PAL.gold) : kind === 'burn' ? hex(PAL.orange) : hex(PAL.white);
    const label = this.scene.add
      .bitmapText(Math.round(x), Math.round(y), FONT, String(Math.round(value)))
      .setOrigin(0.5, 1)
      .setTint(tint)
      .setDepth(8000);
    if (kind === 'crit') label.setScale(1.4);

    this.scene.tweens.add({
      targets: label,
      y: y - (kind === 'crit' ? 22 : 16),
      alpha: 0,
      duration: kind === 'crit' ? 700 : 520,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /** A short word at a world position, used for picked-up resources and "PERFECT". */
  floatText(x: number, y: number, text: string, color: string = PAL.white, scale = 1): void {
    const label = this.scene.add
      .bitmapText(Math.round(x), Math.round(y), FONT, text)
      .setOrigin(0.5, 1)
      .setTint(hex(color))
      .setScale(scale)
      .setDepth(8000);
    this.scene.tweens.add({
      targets: label,
      y: y - 18,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /** A burst of small sparks, tinted to whatever hit. */
  sparks(x: number, y: number, color: string, count = 6, speed = 90): void {
    const emitter = this.scene.add.particles(x, y, FX.spark, {
      tint: hex(color),
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 0, max: 360 },
      lifespan: { min: 160, max: 320 },
      scale: { start: 1, end: 0 },
      quantity: count,
      emitting: false,
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setDepth(7000);
    emitter.explode(count);
    this.scene.time.delayedCall(400, () => emitter.destroy());
  }

  /** An expanding ring, used for perfect dodges and ground shocks. */
  ring(x: number, y: number, color: string, radius = 30, ms = 260): void {
    const img = this.scene.add
      .image(x, y, FX.ring)
      .setTint(hex(color))
      .setDepth(7000)
      .setScale(0.2)
      .setAlpha(0.9);
    this.scene.tweens.add({
      targets: img,
      scale: radius / 32,
      alpha: 0,
      duration: ms,
      ease: 'Cubic.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  /** A short white flash on a sprite. The core of every hit in the game. */
  static flashSprite(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    ms: number = BAL.combat.flashMs,
  ): void {
    if (state.settings.flashReduction) {
      sprite.setTint(hex(PAL.blood));
      scene.time.delayedCall(ms, () => sprite.clearTint());
      return;
    }
    sprite.setTintFill(0xffffff);
    scene.time.delayedCall(ms, () => sprite.clearTint());
  }

  /** Squash and stretch, for impacts and pickups. */
  static punch(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform, amount = 0.25): void {
    const t = target as unknown as { scaleX: number; scaleY: number };
    const sx = t.scaleX;
    const sy = t.scaleY;
    scene.tweens.add({
      targets: target,
      scaleX: sx * (1 + amount),
      scaleY: sy * (1 - amount * 0.6),
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        t.scaleX = sx;
        t.scaleY = sy;
      },
    });
  }

  destroy(): void {
    this.subs.dispose();
    this.scene.time.timeScale = 1;
    this.scene.tweens.timeScale = 1;
    if (this.scene.physics?.world) this.scene.physics.world.timeScale = 1;
    this.flashRect?.destroy();
    this.flashRect = undefined;
  }
}
