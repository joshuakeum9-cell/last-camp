import type { EnemyBase, EnemyBehavior, EnemyHitbox, ToPlayer } from '../EnemyBase';

/**
 * Ice Skater. Lives on the lake and never stops moving. It circles wide, lines up,
 * then slides straight through where you are standing at full speed and does not
 * slow down until it is well past. The lesson is sideways: a step off its line is
 * a whole miss, and it takes a long curve to come back round.
 */
export const iceSkaterBehavior: EnemyBehavior = {
  steer(e: EnemyBase, to: ToPlayer) {
    const speed = e.moveSpeed;
    const gap = to.dist - e.def.keepDistance;
    const sideX = -to.dy;
    const sideY = to.dx;
    const spin = e.id.charCodeAt(5) % 2 === 0 ? 1 : -1;
    const pull = Math.max(-1, Math.min(1, gap / 50));
    return {
      vx: (sideX * spin * 0.9 + to.dx * pull * 0.6) * speed,
      vy: (sideY * spin * 0.9 + to.dy * pull * 0.6) * speed,
    };
  },

  shouldAttack(e: EnemyBase, to: ToPlayer) {
    return to.dist <= e.def.attackRange && to.dist > 30;
  },

  makeHitbox(e: EnemyBase): EnemyHitbox {
    return {
      x: e.cx,
      y: e.cy,
      radius: 12,
      damage: e.damage,
      until: e.scene.time.now + e.def.active * 1000,
      spent: false,
      follow: true,
      bornAt: e.scene.time.now,
    };
  },

  onAttackTick(e: EnemyBase, phase, t, to) {
    if (phase === 'windup') {
      // Drifts sideways while it lines up, so the tell is the pause in the circling.
      e.body.setVelocity(e.body.velocity.x * 0.8, e.body.velocity.y * 0.8);
      if (t > 0.7) e.sprite.setData('slideDir', { x: to.dx, y: to.dy });
      return;
    }
    const dir = (e.sprite.getData('slideDir') as { x: number; y: number }) ?? { x: to.dx, y: to.dy };
    // Full speed the whole way. Ice does not slow anything down.
    e.body.setVelocity(dir.x * e.rushSpeed, dir.y * e.rushSpeed);
  },
};
