import Phaser from 'phaser';
import type { EnemyBase, EnemyBehavior, EnemyHitbox, ToPlayer } from '../EnemyBase';
import { WFX } from '../../art/sprites/weapons';
import { hex, PAL } from '../../art/palette';
import { bus } from '../../core/EventBus';

/**
 * Snow Spitter. Never closes. It punishes standing still, which is exactly the habit
 * a player picks up after a few days of melee.
 */
export const snowSpitterBehavior: EnemyBehavior = {
  steer(e: EnemyBase, to: ToPlayer) {
    const speed = e.moveSpeed;
    const gap = to.dist - e.def.keepDistance;
    // Backs off when crowded, drifts closer when the player runs away.
    const pull = Math.max(-1, Math.min(1, gap / 40));
    const sideX = -to.dy * 0.35;
    const sideY = to.dx * 0.35;
    return { vx: (to.dx * pull + sideX) * speed, vy: (to.dy * pull + sideY) * speed };
  },

  shouldAttack(e: EnemyBase, to: ToPlayer) {
    return to.dist <= e.def.attackRange;
  },

  /** The spit is a projectile, so the enemy itself never holds a damage zone. */
  makeHitbox(e: EnemyBase, to: ToPlayer): EnemyHitbox | null {
    spawnSpit(e, to);
    return null;
  },
};

function spawnSpit(e: EnemyBase, to: ToPlayer): void {
  const scene = e.scene;
  const shot = scene.add
    .image(e.cx, e.cy, WFX.spit)
    .setScale(2)
    .setTint(hex(PAL.green))
    .setDepth(e.sprite.y + 1);

  const dirX = to.dx;
  const dirY = to.dy;
  const speed = 120;
  const startX = shot.x;
  const startY = shot.y;
  const damage = e.damage;
  bus.emit('audio:play', { cue: 'spit', volume: 0.5 });

  const tick = () => {
    if (!shot.active) return;
    shot.x += dirX * speed * (1 / 60);
    shot.y += dirY * speed * (1 / 60);
    shot.setDepth(shot.y + 1);
    shot.rotation += 0.2;

    const player = scene.registry.get('player') as
      | { cx: number; cy: number; isInvulnerable: boolean; takeDamage: (...args: never[]) => boolean }
      | undefined;

    if (player) {
      const d = Phaser.Math.Distance.Between(shot.x, shot.y, player.cx, player.cy);
      if (d < 10) {
        if (!player.isInvulnerable) {
          (player.takeDamage as unknown as (a: number, b: number, c: number, d: string) => boolean)(
            damage,
            shot.x,
            shot.y,
            'spitter',
          );
        }
        shot.destroy();
        return;
      }
    }

    if (Phaser.Math.Distance.Between(shot.x, shot.y, startX, startY) > 220) {
      shot.destroy();
      return;
    }
    scene.time.delayedCall(16, tick);
  };
  tick();
}
