import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { Rng } from '../core/Rng';
import { RESOURCES, type ResourceId } from '../data/resources';
import { Juice } from '../systems/Juice';
import { Pickup } from './Pickup';
import { state } from '../core/GameState';

export type BreakableKind = 'crate' | 'iceChunk';

/**
 * Crates and ice chunks. They exist for the every-few-seconds feedback rhythm: one hit,
 * a satisfying burst, sometimes something in it. The ice chunk beside the cracked lake
 * is also what opens the hollow.
 */
export class Breakable {
  private broken = false;
  private rng: Rng;

  constructor(
    private scene: Phaser.Scene,
    readonly kind: BreakableKind,
    readonly sprite: Phaser.GameObjects.Image,
    private juice: Juice,
    private spawnPickup: (p: Pickup) => void,
    seed: number,
    /** Fired when this chunk is the one hiding a way through. */
    private onBreak?: () => void,
  ) {
    this.rng = new Rng(seed);
  }

  get alive(): boolean {
    return !this.broken;
  }

  get cx(): number {
    return this.sprite.x;
  }

  get cy(): number {
    return this.sprite.y - this.sprite.displayHeight * 0.4;
  }

  get radius(): number {
    return Math.max(9, this.sprite.displayWidth * 0.45);
  }

  hit(): void {
    if (this.broken) return;
    this.broken = true;

    const color = this.kind === 'crate' ? RESOURCES.wood.color : RESOURCES.crystal.color;
    this.juice.sparks(this.cx, this.cy, color, 10, 120);
    bus.emit('breakable:broken', { kind: this.kind });
    bus.emit('audio:play', { cue: 'smash' });
    bus.emit('juice:shake', { intensity: 2, ms: 80 });
    if (state.run) state.run.breakables++;

    if (this.rng.chance(0.55)) {
      const id: ResourceId = this.kind === 'crate' ? (this.rng.chance(0.5) ? 'wood' : 'scrap') : 'crystal';
      const amount = this.kind === 'crate' ? this.rng.int(1, 2) : 1;
      this.spawnPickup(new Pickup(this.scene, id, amount, this.cx, this.cy));
    }

    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: this.sprite.scaleX * 1.3,
      scaleY: this.sprite.scaleY * 0.5,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.sprite.destroy();
        this.onBreak?.();
      },
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
  }
}
