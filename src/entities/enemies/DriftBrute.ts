import Phaser from 'phaser';
import type { EnemyBase, EnemyBehavior, EnemyHitbox, ToPlayer } from '../EnemyBase';
import { WFX } from '../../art/sprites/weapons';
import { hex, PAL } from '../../art/palette';
import { bus } from '../../core/EventBus';

/**
 * Drift Brute. A snow-caked hulk that walks straight at you and, once close, drops
 * both fists. The slam is a circle round itself rather than a swing, so there is
 * no safe side, only distance. It cannot be staggered and it shrugs off knockback,
 * so it is the first thing that has to be kited rather than traded with.
 */
export const driftBruteBehavior: EnemyBehavior = {
  steer(e: EnemyBase, to: ToPlayer) {
    return { vx: to.dx * e.moveSpeed, vy: to.dy * e.moveSpeed };
  },

  shouldAttack(e: EnemyBase, to: ToPlayer) {
    return to.dist <= e.def.attackRange;
  },

  makeHitbox(e: EnemyBase): EnemyHitbox {
    const radius = e.def.telegraphSize;
    const shock = e.scene.add
      .image(e.cx, e.cy, WFX.shock)
      .setTint(hex(PAL.snow))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.25)
      .setDepth(e.sprite.y - 1);
    e.scene.tweens.add({
      targets: shock,
      scale: (radius * 2) / 80,
      alpha: 0,
      duration: 260,
      onComplete: () => shock.destroy(),
    });
    bus.emit('juice:shake', { intensity: 3, ms: 160 });
    bus.emit('audio:play', { cue: 'smash', volume: 0.7 });

    return {
      x: e.cx,
      y: e.cy,
      radius,
      damage: e.damage,
      until: e.scene.time.now + e.def.active * 1000,
      spent: false,
      follow: false,
      bornAt: e.scene.time.now,
    };
  },

  onAttackTick(e: EnemyBase, phase) {
    if (phase === 'windup' || phase === 'attack') e.body.setVelocity(0, 0);
  },
};
