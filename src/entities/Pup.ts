import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL } from '../data/balance';
import { hex, PAL } from '../art/palette';
import { wolfSprite } from '../art/sprites/enemies';
import type { EnemyBase } from './EnemyBase';
import type { Juice } from '../systems/Juice';

/**
 * The Alpha Beast's pup. Left behind at the cabin when the alpha dies; taken in,
 * it follows the player everywhere, bites whatever comes close, and cannot be
 * hurt. Mira gathers, the pup fights. The wolf sprite at half size, pale, so it
 * reads as the same animal and the opposite of a threat.
 */
export class Pup {
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private x: number;
  private y: number;
  private nextBiteAt = 0;
  private lastX = 0;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private juice: Juice | null,
  ) {
    this.x = x;
    this.y = y;
    this.shadow = scene.add.ellipse(x, y - 1, 12, 5, hex(PAL.blue)).setAlpha(0.3).setDepth(y - 2);
    this.sprite = scene.add
      .sprite(x, y, wolfSprite.key)
      .setOrigin(0.5, 1)
      .setScale(0.55)
      .setTint(hex(PAL.snow))
      .setDepth(y)
      .play(`${wolfSprite.key}_idle`);
  }

  get cx(): number {
    return this.x;
  }

  get cy(): number {
    return this.y - 5;
  }

  inRange(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.cx, this.cy) < 24;
  }

  /** Follows at the player's other shoulder and bites anything within reach. */
  update(dt: number, playerX: number, playerY: number, enemies: EnemyBase[]): void {
    const seconds = dt / 1000;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    // A target close to the pup or the player is worth a lunge.
    let target: EnemyBase | null = null;
    let best = 44;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.min(Math.hypot(e.cx - this.x, e.cy - this.cy), Math.hypot(e.cx - playerX, e.cy - playerY));
      if (d < best) {
        best = d;
        target = e;
      }
    }

    if (target) {
      const tx = target.cx - this.x;
      const ty = target.cy - this.cy;
      const td = Math.hypot(tx, ty) || 1;
      if (td > 14) {
        const speed = BAL.player.speed * 1.2;
        this.x += (tx / td) * speed * seconds;
        this.y += (ty / td) * speed * seconds;
        this.sprite.play(`${wolfSprite.key}_run`, true);
      } else if (this.scene.time.now >= this.nextBiteAt) {
        this.nextBiteAt = this.scene.time.now + 1100;
        const damage = 3 + Math.floor(state.day * 0.4);
        target.takeDamage(damage, this.x, this.cy, 40, false);
        this.sprite.play(`${wolfSprite.key}_attack`, true);
        this.juice?.sparks(target.cx, target.cy, PAL.snow, 5, 80);
        bus.emit('audio:play', { cue: 'hit', volume: 0.5, rate: 1.4 });
      }
      if (Math.abs(tx) > 2) this.sprite.setFlipX(tx < 0);
    } else if (dist > 200) {
      this.x = playerX + 18;
      this.y = playerY + 6;
    } else if (dist > 26) {
      const speed = BAL.player.speed * (dist > 80 ? 1.25 : 1);
      this.x += (dx / dist) * speed * seconds;
      this.y += (dy / dist) * speed * seconds;
      this.sprite.play(`${wolfSprite.key}_run`, true);
      if (Math.abs(dx) > 2) this.sprite.setFlipX(dx < 0);
    } else if (Math.abs(this.x - this.lastX) < 0.5) {
      this.sprite.play(`${wolfSprite.key}_idle`, true);
    }
    this.lastX = this.x;

    this.sprite.setPosition(Math.round(this.x), Math.round(this.y)).setDepth(this.y);
    this.shadow.setPosition(this.x, this.y - 1).setDepth(this.y - 2);
  }

  destroy(): void {
    this.shadow.destroy();
    this.sprite.destroy();
  }
}
