import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL } from '../data/balance';
import type { EnemyBase } from '../entities/EnemyBase';
import type { ResourceNode } from '../entities/ResourceNode';
import type { Breakable } from '../entities/Breakable';
import type { Boss, BossHitbox } from '../entities/Boss';
import type { Player } from '../entities/Player';
import type { SwingShape, WeaponDef } from '../data/weapons';
import { UPGRADES } from '../data/upgrades';
import type { Juice } from './Juice';
import { PAL } from '../art/palette';

export interface StrikeRequest {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  weapon: WeaponDef;
  damage: number;
  knockback: number;
  crit: number;
  reach: number;
  shape: SwingShape;
  arcDeg: number;
  thrustWidth: number;
  pierce: boolean;
  stun: number;
  flags: string[];
}

export interface StrikeResult {
  hits: number;
  killed: number;
  crits: number;
}

/**
 * Owns the damage rules for both directions: the player's swings against enemies, and
 * enemy hitboxes against the player. Geometry is checked directly rather than through
 * physics bodies, because a swing needs to be an arc, not a rectangle.
 */
export class CombatSystem {
  private enemies: EnemyBase[] = [];
  /** Harvestable scenery. A swing that misses an enemy should still fell a tree. */
  nodes: ResourceNode[] = [];
  breakables: Breakable[] = [];
  /** The Maw is its own controller, so it is checked alongside the enemy list. */
  bosses: Boss[] = [];

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private juice: Juice,
  ) {}

  register(enemy: EnemyBase): void {
    this.enemies.push(enemy);
  }

  setEnemies(list: EnemyBase[]): void {
    this.enemies = list;
  }

  get list(): EnemyBase[] {
    return this.enemies;
  }

  /** Total damage multiplier from perks, camp upgrades and the current run. */
  damageMultiplier(): number {
    let mult = 1 + 0.05 * (state.player.perks.sharpedge ?? 0);
    if (state.camp.upgrades.trophy) mult += UPGRADES.trophy.effects.damageMult ?? 0;
    return mult;
  }

  /** The player swings. Returns what it connected with, for combo and feedback. */
  strike(req: StrikeRequest): StrikeResult {
    const result: StrikeResult = { hits: 0, killed: 0, crits: 0 };
    const now = this.scene.time.now;
    const perfectCrit = now < this.player.perfectCritUntil;

    // Nearest first, so a swing that can only land once lands on the thing in
    // front of you rather than whichever spawned earliest.
    const ordered = this.enemies
      .filter((e) => e.alive)
      .sort((a, b) => Math.hypot(a.cx - req.x, a.cy - req.y) - Math.hypot(b.cx - req.x, b.cy - req.y));

    for (const enemy of ordered) {
      if (!this.inSwing(req, enemy.cx, enemy.cy)) continue;

      const crit = perfectCrit || Math.random() < req.crit;
      const raw = req.damage * this.damageMultiplier() * (crit ? BAL.combat.critMultiplier : 1);
      const damage = Math.max(1, Math.round(raw));

      enemy.takeDamage(damage, req.x, req.y, req.knockback, crit);
      if (req.stun > 0) enemy.applyStun(req.stun);
      if (req.weapon.slow) enemy.applySlow(req.weapon.slow.amount, req.weapon.slow.seconds);

      if (req.flags.includes('lifesteal')) this.player.heal(Math.max(1, Math.round(damage * 0.1)), 'lifesteal');
      if (req.flags.includes('vampiric')) this.player.heal(Math.max(1, Math.round(damage * 0.06)), 'vampiric');

      result.hits++;
      if (crit) result.crits++;
      if (!enemy.alive) result.killed++;

      if (!req.pierce) break;
    }

    for (const boss of this.bosses) {
      if (!boss.alive || !this.inSwing({ ...req, reach: req.reach + 20 }, boss.cx, boss.cy)) continue;
      const crit = perfectCrit || Math.random() < req.crit;
      const damage = Math.max(
        1,
        Math.round(req.damage * this.damageMultiplier() * (crit ? BAL.combat.critMultiplier : 1)),
      );
      boss.takeDamage(damage, req.x, req.y, req.knockback, crit);
      if (req.stun > 0) boss.applyStun(req.stun);
      if (req.flags.includes('lifesteal')) this.player.heal(Math.max(1, Math.round(damage * 0.1)), 'lifesteal');
      result.hits++;
      if (crit) result.crits++;
    }

    this.strikeScenery(req);

    if (result.hits > 0 && perfectCrit) this.player.perfectCritUntil = 0;
    return result;
  }

  /**
   * The same swing also works on the world. Gathering uses the combat verb, which is
   * what keeps the rhythm of a run consistent whether you are fighting or foraging.
   */
  private strikeScenery(req: StrikeRequest): void {
    const breaker = req.flags.includes('nodeBreaker');
    const woodBonus = req.flags.includes('nodeBreaker') ? 0.3 : 0;

    for (const node of this.nodes) {
      if (!node.alive) continue;
      if (!this.inSwing({ ...req, reach: req.reach + node.radius }, node.cx, node.cy)) continue;
      node.hit(req.x, req.y, breaker, woodBonus);
      if (!req.pierce) break;
    }
    for (const b of this.breakables) {
      if (!b.alive) continue;
      if (!this.inSwing({ ...req, reach: req.reach + b.radius }, b.cx, b.cy)) continue;
      b.hit();
      if (!req.pierce) break;
    }
  }

  private inSwing(req: StrikeRequest, tx: number, ty: number): boolean {
    const dx = tx - req.x;
    const dy = ty - req.y;
    const dist = Math.hypot(dx, dy);

    if (req.shape === 'circle') return dist <= req.reach;
    if (dist > req.reach) return false;
    // Anything overlapping the player is always in range, so a swing never whiffs on
    // an enemy that is standing on top of you.
    if (dist < 10) return true;

    const aim = Math.atan2(req.dirY, req.dirX);
    const toTarget = Math.atan2(dy, dx);
    const delta = Math.abs(Phaser.Math.Angle.Wrap(toTarget - aim));

    if (req.shape === 'thrust') {
      // Perpendicular distance from the thrust line.
      const along = dx * req.dirX + dy * req.dirY;
      if (along < 0) return false;
      const perp = Math.abs(dx * -req.dirY + dy * req.dirX);
      return perp <= req.thrustWidth / 2;
    }

    return delta <= (req.arcDeg / 2) * (Math.PI / 180);
  }

  /**
   * Enemy hitboxes against the player, plus the perfect dodge check. Called once a
   * frame by the scene after every enemy has updated.
   */
  update(): void {
    const now = this.scene.time.now;
    const px = this.player.cx;
    const py = this.player.cy;

    for (const boss of this.bosses) {
      if (boss.hitbox) this.checkHitbox(boss.hitbox, boss.id, now, px, py);
    }

    for (const enemy of this.enemies) {
      if (enemy.hitbox) this.checkHitbox(enemy.hitbox, enemy.def.id, now, px, py);
    }
  }

  /** Shared between ordinary enemies and the boss. */
  private checkHitbox(box: BossHitbox, source: string, now: number, px: number, py: number): void {
    if (box.spent || now > box.until) return;
    const dist = Math.hypot(px - box.x, py - box.y);
    if (dist > box.radius + BAL.player.bodyRadius) return;
    // A ring: inside the band is safe, which is what makes it something to dash through.
    if (box.innerRadius !== undefined && dist < box.innerRadius - BAL.player.bodyRadius) return;

    // A dash started just as the box opened is a read, not luck. Reward it.
    const dashedInTime =
      this.player.isDashing &&
      Math.abs(this.player.lastDashAt - box.bornAt) <= BAL.dash.perfectWindow * 1000;

    if (dashedInTime) {
      box.spent = true;
      this.player.awardPerfectDodge();
      this.juice.ring(px, py, PAL.white, 34, 300);
      this.juice.floatText(px, this.player.sprite.y - 30, 'PERFECT', PAL.gold, 1.2);
      return;
    }

    if (this.player.isInvulnerable) return;
    box.spent = true;
    this.player.takeDamage(box.damage, box.x, box.y, source);
  }

  /** Nearest living enemy within `range`, for aim assist and the bow. */
  nearest(x: number, y: number, range: number): EnemyBase | null {
    let best: EnemyBase | null = null;
    let bestDist = range;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.cx - x, e.cy - y);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    return best;
  }

  /** Damage from a source that is not a weapon swing: burning, hazards, projectiles. */
  damageEnemy(enemy: EnemyBase, amount: number, fromX: number, fromY: number, knockback = 0): void {
    if (!enemy.alive) return;
    enemy.takeDamage(Math.max(1, Math.round(amount)), fromX, fromY, knockback, false);
  }

  removeDead(): void {
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  destroy(): void {
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    this.nodes = [];
    this.breakables = [];
    void bus;
  }
}
