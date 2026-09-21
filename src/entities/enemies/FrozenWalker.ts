import type { EnemyBase, EnemyBehavior, EnemyHitbox, ToPlayer } from '../EnemyBase';

/**
 * Frozen Walker. Slow, heavy, and it cannot be staggered. Its overhead slam is the
 * longest telegraph in the game and the hardest hit, which teaches the player that
 * some fights are about position rather than pressure.
 */
export const frozenWalkerBehavior: EnemyBehavior = {
  steer(e: EnemyBase, to: ToPlayer) {
    return { vx: to.dx * e.def.speed, vy: to.dy * e.def.speed };
  },

  shouldAttack(e: EnemyBase, to: ToPlayer) {
    return to.dist <= e.def.attackRange;
  },

  makeHitbox(e: EnemyBase): EnemyHitbox {
    // The slam lands where the telegraph was drawn, not where the player is now.
    return {
      x: e.cx,
      y: e.cy,
      radius: e.def.telegraphSize,
      damage: e.damage,
      until: e.scene.time.now + e.def.active * 1000,
      spent: false,
      follow: false,
      bornAt: e.scene.time.now,
    };
  },

  onAttackTick(e: EnemyBase, phase) {
    // It plants itself for the whole swing. Walking away always works, if you start
    // walking in time.
    if (phase === 'windup' || phase === 'attack') e.body.setVelocity(0, 0);
  },
};
