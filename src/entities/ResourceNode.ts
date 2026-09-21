import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { Rng } from '../core/Rng';
import { hex, PAL } from '../art/palette';
import { FX } from '../art/sprites/fx';
import type { ResourceId } from '../data/resources';
import { RESOURCES } from '../data/resources';
import { Juice } from '../systems/Juice';
import { Pickup } from './Pickup';

export type NodeKind = 'pine' | 'pineSmall' | 'deadTree' | 'wreck' | 'bush' | 'crystal';

interface NodeRule {
  resource: ResourceId;
  hits: number;
  yield: [number, number];
  /** Extra pickups spat out on every hit, before the final break. */
  chip: number;
}

const RULES: Record<NodeKind, NodeRule> = {
  pine: { resource: 'wood', hits: 3, yield: [3, 5], chip: 1 },
  pineSmall: { resource: 'wood', hits: 2, yield: [2, 3], chip: 1 },
  deadTree: { resource: 'wood', hits: 2, yield: [2, 4], chip: 1 },
  wreck: { resource: 'scrap', hits: 3, yield: [2, 4], chip: 1 },
  bush: { resource: 'food', hits: 1, yield: [1, 2], chip: 0 },
  crystal: { resource: 'crystal', hits: 4, yield: [1, 1], chip: 0 },
};

/**
 * Anything the player can hit for materials. Every hit shakes it and throws off a
 * pickup, so gathering has the same feedback rhythm as fighting.
 */
export class ResourceNode {
  readonly sprite: Phaser.GameObjects.Image;
  readonly kind: NodeKind;
  readonly rule: NodeRule;
  private hitsLeft: number;
  private rng: Rng;
  private broken = false;
  private shadow: Phaser.GameObjects.Ellipse;
  private baseY: number;

  constructor(
    private scene: Phaser.Scene,
    kind: NodeKind,
    sprite: Phaser.GameObjects.Image,
    shadow: Phaser.GameObjects.Ellipse,
    private juice: Juice,
    private spawnPickup: (p: Pickup) => void,
    seed: number,
  ) {
    this.kind = kind;
    this.rule = RULES[kind];
    this.sprite = sprite;
    this.shadow = shadow;
    this.hitsLeft = this.rule.hits;
    this.rng = new Rng(seed);
    this.baseY = sprite.y;
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

  /** Radius used for swing checks. Wide enough that hitting a tree is never fiddly. */
  get radius(): number {
    return Math.max(10, this.sprite.displayWidth * 0.4);
  }

  /** `breaker` weapons fell a node in one blow. */
  hit(fromX: number, fromY: number, breaker: boolean, woodBonus: number): void {
    if (this.broken) return;
    this.hitsLeft = breaker ? 0 : this.hitsLeft - 1;

    const def = RESOURCES[this.rule.resource];
    Juice.flashSprite(this.scene, this.sprite, 70);
    this.juice.sparks(this.cx, this.cy, def.color, 5, 70);
    bus.emit('audio:play', { cue: `chop-${this.rule.resource}` });
    bus.emit('juice:shake', { intensity: 1.5, ms: 70 });

    // Lean away from the blow, then snap back.
    const away = this.cx - fromX >= 0 ? 1 : -1;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setAngle(0);
    this.scene.tweens.add({
      targets: this.sprite,
      angle: away * 7,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.sprite.setAngle(0),
    });

    if (this.hitsLeft > 0) {
      for (let i = 0; i < this.rule.chip; i++) this.drop(1, woodBonus);
      return;
    }
    this.breakNode(woodBonus);
  }

  private breakNode(woodBonus: number): void {
    this.broken = true;
    const [min, max] = this.rule.yield;
    const total = this.rng.int(min, max);
    for (let i = 0; i < total; i++) this.drop(1, woodBonus);

    this.juice.sparks(this.cx, this.cy, RESOURCES[this.rule.resource].color, 12, 120);
    bus.emit('node:broken', { kind: this.kind });
    bus.emit('audio:play', { cue: 'nodeBreak' });
    bus.emit('juice:shake', { intensity: 3, ms: 110 });

    // Topple rather than vanish, so felling something reads as an event.
    this.scene.tweens.add({
      targets: this.sprite,
      angle: this.rng.chance(0.5) ? -78 : 78,
      y: this.baseY + 4,
      alpha: 0,
      duration: 420,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 420 });

    const stump = this.scene.add
      .image(this.sprite.x, this.baseY, FX.dot3)
      .setTint(hex(PAL.woodDark))
      .setScale(3, 1.4)
      .setDepth(this.baseY - 1)
      .setAlpha(0.8);
    this.scene.time.delayedCall(40, () => stump.setDepth(this.baseY - 1));
  }

  private drop(amount: number, woodBonus: number): void {
    const final =
      this.rule.resource === 'wood' ? Math.max(1, Math.round(amount * (1 + woodBonus))) : amount;
    this.spawnPickup(
      new Pickup(
        this.scene,
        this.rule.resource,
        final,
        this.cx + this.rng.range(-4, 4),
        this.cy + this.rng.range(-3, 3),
      ),
    );
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
  }
}

export const NODE_KINDS: NodeKind[] = ['pine', 'pineSmall', 'deadTree', 'wreck', 'bush', 'crystal'];
