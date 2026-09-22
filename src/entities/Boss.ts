import type Phaser from 'phaser';

/** A damage zone a boss puts into the world. Rings hurt only between the two radii. */
export interface BossHitbox {
  x: number;
  y: number;
  radius: number;
  /** Set for expanding rings: inside this is safe. */
  innerRadius?: number;
  damage: number;
  until: number;
  spent: boolean;
  bornAt: number;
}

/**
 * What the scene, the combat system and the HUD need from a boss. Each boss owns
 * its own patterns; this is only the surface they share.
 */
export interface Boss {
  readonly id: string;
  readonly name: string;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  readonly maxHp: number;
  hitbox: BossHitbox | null;
  readonly alive: boolean;
  readonly cx: number;
  readonly cy: number;
  update(dt: number): void;
  takeDamage(amount: number, fromX: number, fromY: number, knockback: number, crit: boolean): number;
  applyStun(seconds: number): void;
  applySlow(amount: number, seconds: number): void;
  destroy(): void;
}
