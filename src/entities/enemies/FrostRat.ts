import type { EnemyBase, EnemyBehavior, EnemyHitbox, ToPlayer } from '../EnemyBase';

/**
 * Frost Rat. Weak alone, a problem in a pack. It closes fast, lunges a short way,
 * and breaks off when it is nearly dead, which teaches the player to keep swinging
 * and keep moving rather than to duel one target.
 */
export const frostRatBehavior: EnemyBehavior = {
  steer(e: EnemyBase, to: ToPlayer) {
    const speed = e.moveSpeed;

    // Below a third health it scatters for a moment. A fleeing rat is a free hit
    // for a player who notices.
    if (e.hp / e.maxHp < 0.3) {
      return { vx: -to.dx * speed * 0.8, vy: -to.dy * speed * 0.8 };
    }

    // Approach at a slight angle so a pack spreads around the player rather than
    // stacking into one sprite.
    const swirl = (hashAngle(e.id) - 0.5) * 0.9;
    const cos = Math.cos(swirl);
    const sin = Math.sin(swirl);
    const vx = (to.dx * cos - to.dy * sin) * speed;
    const vy = (to.dx * sin + to.dy * cos) * speed;
    return { vx, vy };
  },

  shouldAttack(e: EnemyBase, to: ToPlayer) {
    return to.dist <= e.def.attackRange && e.hp / e.maxHp >= 0.3;
  },

  makeHitbox(e: EnemyBase, to: ToPlayer): EnemyHitbox {
    return {
      x: e.cx + to.dx * 10,
      y: e.cy + to.dy * 10,
      radius: 11,
      damage: e.damage,
      until: e.scene.time.now + e.def.active * 1000,
      spent: false,
      follow: true,
      bornAt: e.scene.time.now,
    };
  },

  onAttackTick(e: EnemyBase, phase, t, to) {
    // A short lunge on the attack frame, so the bite has travel behind it.
    if (phase === 'attack' && t < 0.5) {
      e.body.setVelocity(to.dx * e.rushSpeed, to.dy * e.rushSpeed);
    }
  },
};

/** Stable pseudo-random per enemy id, so each rat keeps its own approach angle. */
function hashAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}
