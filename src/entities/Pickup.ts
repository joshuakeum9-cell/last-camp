import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL } from '../data/balance';
import { RESOURCES, type ResourceId } from '../data/resources';
import { hex, PAL } from '../art/palette';
import { FX } from '../art/sprites/fx';
import { ResourceSystem } from '../systems/ResourceSystem';
import type { Juice } from '../systems/Juice';

/**
 * A dropped resource. It pops out, settles, then flies to the player once they are
 * close. The pull is the reward: it should feel like the world is handing things over.
 */
export class Pickup {
  readonly sprite: Phaser.GameObjects.Image;
  private glow?: Phaser.GameObjects.Image;
  private vx: number;
  private vy: number;
  private settled = false;
  private born: number;
  private collected = false;

  constructor(
    private scene: Phaser.Scene,
    readonly id: ResourceId,
    readonly amount: number,
    x: number,
    y: number,
  ) {
    const def = RESOURCES[id];
    this.born = scene.time.now;

    this.sprite = scene.add
      .image(x, y, def.rare ? FX.dot3 : FX.dot2)
      .setTint(hex(def.color))
      .setScale(def.rare ? 2 : 1.8)
      .setDepth(y + 2);

    if (def.rare) {
      this.glow = scene.add
        .image(x, y, FX.glowSmall)
        .setTint(hex(def.color))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.8)
        .setDepth(y + 1);
      scene.tweens.add({
        targets: this.glow,
        alpha: 0.35,
        scale: 1.4,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }

    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 50;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 40;

    scene.tweens.add({
      targets: this.sprite,
      scale: this.sprite.scale * 1.4,
      duration: 90,
      yoyo: true,
    });
  }

  get active(): boolean {
    return !this.collected && this.sprite.active;
  }

  /** Returns true once it has been taken, so the caller can drop it from its list. */
  update(dt: number, playerX: number, playerY: number, juice: Juice): boolean {
    if (this.collected) return true;
    const seconds = dt / 1000;
    const dist = Math.hypot(playerX - this.sprite.x, playerY - this.sprite.y);

    if (dist < BAL.combat.magnetRadius) {
      // Accelerate toward the player rather than snapping, which reads as attraction.
      const dx = playerX - this.sprite.x;
      const dy = playerY - this.sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      const pull = BAL.combat.magnetSpeed * (1 - dist / BAL.combat.magnetRadius) + 90;
      this.vx = Phaser.Math.Linear(this.vx, (dx / len) * pull, 0.35);
      this.vy = Phaser.Math.Linear(this.vy, (dy / len) * pull, 0.35);
      this.settled = false;
    } else if (!this.settled) {
      this.vx *= 0.88;
      this.vy = this.vy * 0.88 + 160 * seconds;
      if (Math.hypot(this.vx, this.vy) < 8 && this.scene.time.now - this.born > 200) {
        this.settled = true;
        this.vx = 0;
        this.vy = 0;
        this.bobIdle();
      }
    }

    this.sprite.x += this.vx * seconds;
    this.sprite.y += this.vy * seconds;
    this.sprite.setDepth(this.sprite.y + 2);
    this.glow?.setPosition(this.sprite.x, this.sprite.y).setDepth(this.sprite.y + 1);

    if (dist < 9) {
      this.take(juice);
      return true;
    }
    return false;
  }

  private bobIdle(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 2,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private take(juice: Juice): void {
    this.collected = true;
    const def = RESOURCES[this.id];
    const night = state.run?.phase === 'night' || state.run?.phase === 'nightfall';
    const granted = ResourceSystem.collect(this.id, this.amount, night);

    juice.floatText(this.sprite.x, this.sprite.y, `+${granted}`, def.color);
    bus.emit('audio:play', { cue: def.rare ? 'pickupRare' : 'pickup' });
    if (def.rare) bus.emit('juice:shake', { intensity: 2, ms: 90 });

    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
    this.glow?.destroy();
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
    this.glow?.destroy();
    void PAL;
  }
}
