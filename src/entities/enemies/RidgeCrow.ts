import type { EnemyBase, EnemyBehavior, EnemyHitbox, ToPlayer } from '../EnemyBase';

/**
 * Ridge Crow. Flies, so trees and drifts mean nothing to it. It wheels at a distance
 * and then dives straight across you, climbing away on the far side. It is weak and
 * it comes in threes, so the lesson is timing: swing as it arrives, not after.
 */
export const ridgeCrowBehavior: EnemyBehavior = {
  steer(e: EnemyBase, to: ToPlayer) {
    const speed = e.moveSpeed;
    const gap = to.dist - e.def.keepDistance;
    const sideX = -to.dy;
    const sideY = to.dx;
    const spin = e.id.charCodeAt(6) % 2 === 0 ? 1 : -1;
    const pull = Math.max(-1, Math.min(1, gap / 45));
    return {
      vx: (sideX * spin + to.dx * pull * 0.7) * speed,
      vy: (sideY * spin + to.dy * pull * 0.7) * speed,
    };
  },

  shouldAttack(e: EnemyBase, to: ToPlayer) {
    return to.dist <= e.def.attackRange && to.dist > 40;
  },

  makeHitbox(e: EnemyBase): EnemyHitbox {
    return {
      x: e.cx,
      y: e.cy,
      radius: 11,
      damage: e.damage,
      until: e.scene.time.now + e.def.active * 1000,
      spent: false,
      follow: true,
      bornAt: e.scene.time.now,
    };
  },

  onAttackTick(e: EnemyBase, phase, t, to) {
    if (phase === 'windup') {
      // Hangs in the air for a beat, then commits to the line it sees at the end.
      e.body.setVelocity(e.body.velocity.x * 0.7, e.body.velocity.y * 0.7);
      if (t > 0.8) e.sprite.setData('diveDir', { x: to.dx, y: to.dy });
      return;
    }
    const dir = (e.sprite.getData('diveDir') as { x: number; y: number }) ?? { x: to.dx, y: to.dy };
    e.body.setVelocity(dir.x * e.rushSpeed, dir.y * e.rushSpeed);
  },
};
