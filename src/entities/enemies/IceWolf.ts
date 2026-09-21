import type { EnemyBase, EnemyBehavior, EnemyHitbox, ToPlayer } from '../EnemyBase';

/**
 * Ice Wolf. Circles at a distance, crouches, then commits to a straight charge it
 * cannot cancel. The long recovery afterwards is the lesson: dodge, then punish.
 */
export const iceWolfBehavior: EnemyBehavior = {
  steer(e: EnemyBase, to: ToPlayer) {
    const speed = e.def.speed;
    const gap = to.dist - e.def.keepDistance;

    // Orbit: mostly sideways, with a little in or out to hold the ring.
    const sideX = -to.dy;
    const sideY = to.dx;
    const spin = e.id.charCodeAt(4) % 2 === 0 ? 1 : -1;
    const pull = Math.max(-1, Math.min(1, gap / 60));

    return {
      vx: (sideX * spin * 0.8 + to.dx * pull) * speed,
      vy: (sideY * spin * 0.8 + to.dy * pull) * speed,
    };
  },

  shouldAttack(e: EnemyBase, to: ToPlayer) {
    return to.dist <= e.def.attackRange && to.dist > 24;
  },

  makeHitbox(e: EnemyBase): EnemyHitbox {
    return {
      x: e.cx,
      y: e.cy,
      radius: 14,
      damage: e.damage,
      until: e.scene.time.now + e.def.active * 1000,
      spent: false,
      follow: true,
      bornAt: e.scene.time.now,
    };
  },

  onAttackTick(e: EnemyBase, phase, t, to) {
    if (phase === 'windup') {
      // Locks its line in the last moment of the crouch, so a late dodge still works.
      e.body.setVelocity(0, 0);
      if (t > 0.85) e.sprite.setData('chargeDir', { x: to.dx, y: to.dy });
      return;
    }
    const dir = (e.sprite.getData('chargeDir') as { x: number; y: number }) ?? { x: to.dx, y: to.dy };
    // Decelerates into the slam, so the end of the charge reads as a commitment.
    const speed = e.def.rushSpeed * (1 - t * 0.35);
    e.body.setVelocity(dir.x * speed, dir.y * speed);
  },
};
