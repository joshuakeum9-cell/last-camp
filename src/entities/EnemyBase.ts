import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL, dayScale } from '../data/balance';
import { activeDifficulty } from '../data/difficulty';
import type { EnemyDef, EnemyId } from '../data/enemies';
import { ENEMY_SPRITE_KEY } from '../art/sprites/enemies';
import { hex, PAL } from '../art/palette';
import { Juice } from '../systems/Juice';
import { FX } from '../art/sprites/fx';

export type EnemyState = 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'hurt' | 'dead';

/** A short-lived damage zone an enemy puts into the world. */
export interface EnemyHitbox {
  x: number;
  y: number;
  radius: number;
  damage: number;
  /** Real time (scene clock) when it stops being dangerous. */
  until: number;
  /** Set once it has connected, so one swing cannot hit twice. */
  spent: boolean;
  /** Moves with the enemy, e.g. a wolf mid-charge. */
  follow: boolean;
  /** When the box became active. Used to judge a perfect dodge. */
  bornAt: number;
}

export interface ToPlayer {
  x: number;
  y: number;
  dx: number;
  dy: number;
  dist: number;
}

/** Per-enemy behaviour. Everything shared lives in EnemyBase. */
export interface EnemyBehavior {
  /** Desired velocity while chasing. */
  steer(e: EnemyBase, to: ToPlayer): { vx: number; vy: number };
  shouldAttack(e: EnemyBase, to: ToPlayer): boolean;
  /** Called once when the active window opens. */
  makeHitbox(e: EnemyBase, to: ToPlayer): EnemyHitbox | null;
  /** Called every frame of windup and attack, for charges and lunges. */
  onAttackTick?(e: EnemyBase, phase: 'windup' | 'attack', t: number, to: ToPlayer): void;
}

export class EnemyBase {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly id: string;

  hp: number;
  maxHp: number;
  damage: number;
  state: EnemyState = 'idle';
  hitbox: EnemyHitbox | null = null;
  /** Set by frost effects and stuns. */
  slowUntil = 0;
  slowAmount = 0;
  stunUntil = 0;
  /** Group id, so a pack can alert together. */
  packId = '';

  private stateUntil = 0;
  private nextAttackAt = 0;
  private telegraph?: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private hpBar?: Phaser.GameObjects.Rectangle;
  private hpBarBack?: Phaser.GameObjects.Rectangle;
  private to: ToPlayer = { x: 0, y: 0, dx: 0, dy: 1, dist: 999 };
  private facing = 1;
  private lastHurtAt = -999;

  constructor(
    readonly scene: Phaser.Scene,
    readonly def: EnemyDef,
    x: number,
    y: number,
    private behavior: EnemyBehavior,
    private juice: Juice,
  ) {
    this.id = `${def.id}-${Math.random().toString(36).slice(2, 9)}`;

    const scale = dayScale(state.day);
    const diff = activeDifficulty(state.settings.difficulty);
    this.maxHp = Math.max(1, Math.round(def.hp * scale.hp * diff.enemyHp));
    this.hp = this.maxHp;
    this.damage = Math.max(1, Math.round(def.damage * scale.damage * diff.enemyDamage));

    this.shadow = scene.add
      .ellipse(x, y - 1, 16, 6, hex(PAL.blue))
      .setAlpha(0.3)
      .setDepth(y - 2);

    this.sprite = scene.physics.add.sprite(x, y, ENEMY_SPRITE_KEY[def.id]);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(y);
    this.sprite.setData('enemy', this);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const w = Math.max(8, Math.round(this.sprite.width * 0.55));
    const h = Math.max(6, Math.round(this.sprite.height * 0.35));
    this.body.setSize(w, h);
    this.body.setOffset((this.sprite.width - w) / 2, this.sprite.height - h);
    this.body.setCollideWorldBounds(true);
    this.body.setMass(def.mass);

    this.play('idle');
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get cx(): number {
    return this.body.center.x;
  }

  get cy(): number {
    return this.body.center.y;
  }

  get alive(): boolean {
    return this.state !== 'dead' && this.hp > 0;
  }

  get busy(): boolean {
    return this.state === 'windup' || this.state === 'attack' || this.state === 'recover';
  }

  private get now(): number {
    return this.scene.time.now;
  }

  /**
   * Behaviours ask the enemy how fast it moves rather than reading the data table, so
   * difficulty and night speed apply everywhere without each behaviour knowing about
   * either of them.
   */
  get moveSpeed(): number {
    return this.def.speed * this.speedScale;
  }

  get rushSpeed(): number {
    return this.def.rushSpeed * this.speedScale;
  }

  private get speedScale(): number {
    const diff = activeDifficulty(state.settings.difficulty);
    const night = state.run?.phase === 'night' ? BAL.day.nightEnemySpeed : 1;
    return diff.enemySpeed * night;
  }

  // --- loop --------------------------------------------------------------

  update(dt: number, playerX: number, playerY: number): void {
    if (!this.alive) return;

    const dx = playerX - this.cx;
    const dy = playerY - this.cy;
    const dist = Math.hypot(dx, dy) || 1;
    this.to = { x: playerX, y: playerY, dx: dx / dist, dy: dy / dist, dist };

    if (this.now < this.stunUntil) {
      this.body.setVelocity(0, 0);
      this.sync();
      return;
    }

    switch (this.state) {
      case 'idle':
        this.body.setVelocity(0, 0);
        if (dist < this.def.aggroRange) this.enter('chase');
        break;

      case 'chase': {
        const { vx, vy } = this.behavior.steer(this, this.to);
        const slow = this.now < this.slowUntil ? 1 - this.slowAmount : 1;
        this.body.setVelocity(vx * slow, vy * slow);
        this.play(Math.hypot(vx, vy) > 6 ? 'run' : 'idle');
        if (this.now >= this.nextAttackAt && this.behavior.shouldAttack(this, this.to)) {
          this.enter('windup');
        }
        break;
      }

      case 'windup':
        this.behavior.onAttackTick?.(this, 'windup', this.phaseT(this.def.windup), this.to);
        if (this.now >= this.stateUntil) this.enter('attack');
        break;

      case 'attack':
        this.behavior.onAttackTick?.(this, 'attack', this.phaseT(this.def.active), this.to);
        if (this.hitbox?.follow) {
          this.hitbox.x = this.cx;
          this.hitbox.y = this.cy;
        }
        if (this.now >= this.stateUntil) this.enter('recover');
        break;

      case 'recover':
        this.body.setVelocity(this.body.velocity.x * 0.86, this.body.velocity.y * 0.86);
        if (this.now >= this.stateUntil) this.enter('chase');
        break;

      case 'hurt':
        if (this.now >= this.stateUntil) this.enter('chase');
        break;
    }

    this.sync();
    void dt;
  }

  private phaseT(duration: number): number {
    const elapsed = duration * 1000 - (this.stateUntil - this.now);
    return Phaser.Math.Clamp(elapsed / (duration * 1000), 0, 1);
  }

  private enter(next: EnemyState): void {
    this.state = next;
    const longer =
      (state.settings.longTelegraphs ? 1.3 : 1) * activeDifficulty(state.settings.difficulty).telegraph;

    switch (next) {
      case 'windup':
        this.stateUntil = this.now + this.def.windup * 1000 * longer;
        this.body.setVelocity(0, 0);
        this.play('windup');
        this.showTelegraph();
        bus.emit('audio:play', { cue: `telegraph-${this.def.id}`, volume: 0.5 });
        break;

      case 'attack':
        this.stateUntil = this.now + this.def.active * 1000;
        this.play('attack');
        this.clearTelegraph();
        this.hitbox = this.behavior.makeHitbox(this, this.to);
        break;

      case 'recover':
        this.stateUntil = this.now + this.def.recovery * 1000;
        this.hitbox = null;
        this.nextAttackAt = this.now + this.def.cooldown * 1000;
        break;

      case 'hurt':
        this.stateUntil = this.now + 140;
        break;

      case 'chase':
        this.play('run');
        break;
    }
  }

  // --- damage ------------------------------------------------------------

  /** Returns the damage actually dealt. */
  takeDamage(amount: number, fromX: number, fromY: number, knockback: number, crit: boolean): number {
    if (!this.alive) return 0;

    this.hp -= amount;
    this.lastHurtAt = this.now;

    Juice.flashSprite(this.scene, this.sprite);
    Juice.punch(this.scene, this.sprite, 0.3);
    this.juice.floatNumber(this.cx, this.sprite.y - this.sprite.height * 0.7, amount, crit ? 'crit' : 'normal');
    this.juice.sparks(this.cx, this.cy, this.def.accent, crit ? 10 : 6, crit ? 130 : 90);
    this.showHpBar();

    const dx = this.cx - fromX;
    const dy = this.cy - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const push = knockback / Math.max(0.4, this.def.mass);
    this.body.setVelocity((dx / len) * push, (dy / len) * push);

    // Light enemies lose their windup when hit. Heavy ones do not, which is the
    // whole reason a Frozen Walker is frightening.
    if (this.def.interruptible && (this.state === 'windup' || this.state === 'chase')) {
      this.clearTelegraph();
      this.hitbox = null;
      this.enter('hurt');
    }

    const kill = this.hp <= 0;
    bus.emit('enemy:hit', { id: this.id, type: this.def.id, damage: amount, crit, kill });
    bus.emit('juice:hitstop', {
      ms: kill ? BAL.combat.hitstopKillMs : crit ? BAL.combat.hitstopCritMs : BAL.combat.hitstopMs,
    });
    bus.emit('juice:shake', {
      intensity: kill ? BAL.combat.shake.kill : crit ? BAL.combat.shake.crit : BAL.combat.shake.hit,
      ms: kill ? BAL.combat.shakeMs.kill : crit ? BAL.combat.shakeMs.crit : BAL.combat.shakeMs.hit,
    });
    bus.emit('audio:play', { cue: crit ? 'critHit' : 'hit' });

    if (kill) this.die();
    return amount;
  }

  applySlow(amount: number, seconds: number): void {
    this.slowAmount = Math.max(this.slowAmount, amount);
    this.slowUntil = Math.max(this.slowUntil, this.now + seconds * 1000);
  }

  applyStun(seconds: number): void {
    if (seconds <= 0) return;
    this.stunUntil = Math.max(this.stunUntil, this.now + seconds * 1000);
    this.clearTelegraph();
    this.hitbox = null;
    if (this.state === 'windup') this.state = 'recover';
  }

  private die(): void {
    this.state = 'dead';
    this.hitbox = null;
    this.clearTelegraph();
    this.hpBar?.destroy();
    this.hpBarBack?.destroy();
    this.body.setVelocity(0, 0);
    this.body.enable = false;

    const night = state.run?.phase === 'night' || state.run?.phase === 'nightfall';
    bus.emit('enemy:killed', { id: this.id, type: this.def.id, x: this.cx, y: this.cy, night });
    bus.emit('audio:play', { cue: 'enemyDie' });

    this.juice.sparks(this.cx, this.cy, this.def.accent, 14, 150);
    this.juice.ring(this.cx, this.cy, this.def.accent, 22, 220);

    this.scene.tweens.add({
      targets: [this.sprite, this.shadow],
      alpha: 0,
      scaleY: 0.4,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  // --- presentation ------------------------------------------------------

  private sync(): void {
    if (Math.abs(this.body.velocity.x) > 4) this.facing = this.body.velocity.x < 0 ? -1 : 1;
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setDepth(this.sprite.y);
    this.shadow.setPosition(this.cx, this.sprite.y - 1).setDepth(this.sprite.y - 2);
    this.shadow.width = Math.max(10, this.sprite.displayWidth * 0.6);

    if (this.hpBar && this.hpBarBack) {
      const top = this.sprite.y - this.sprite.displayHeight - 5;
      this.hpBarBack.setPosition(this.cx - 9, top);
      this.hpBar.setPosition(this.cx - 9, top);
      this.hpBar.width = Math.max(0, 18 * (this.hp / this.maxHp));
      const fade = this.now - this.lastHurtAt > 1800;
      this.hpBar.setAlpha(fade ? 0 : 1);
      this.hpBarBack.setAlpha(fade ? 0 : 1);
    }
  }

  private showHpBar(): void {
    if (this.hpBar) return;
    // Only enemies that take more than a couple of hits need a bar.
    if (this.maxHp <= 20) return;
    this.hpBarBack = this.scene.add
      .rectangle(this.cx - 9, this.sprite.y - 20, 18, 3, hex(PAL.navy))
      .setOrigin(0)
      .setDepth(7400);
    this.hpBar = this.scene.add
      .rectangle(this.cx - 9, this.sprite.y - 20, 18, 3, hex(PAL.blood))
      .setOrigin(0)
      .setDepth(7401);
  }

  /**
   * Telegraphs are always a shape as well as a colour, so the read never depends on
   * seeing red.
   */
  private showTelegraph(): void {
    this.clearTelegraph();
    const g = this.scene.add.graphics().setDepth(1);
    this.telegraph = g;
    const color = hex(PAL.blood);
    const size = this.def.telegraphSize;

    if (this.def.telegraph === 'circle') {
      g.lineStyle(2, color, 0.9);
      g.strokeEllipse(this.cx, this.cy, size * 2, size * 1.1);
      g.fillStyle(color, 0.16);
      g.fillEllipse(this.cx, this.cy, size * 2, size * 1.1);
    } else if (this.def.telegraph === 'line') {
      const a = Math.atan2(this.to.dy, this.to.dx);
      g.fillStyle(color, 0.2);
      g.lineStyle(2, color, 0.85);
      const w = 22;
      const p1 = { x: this.cx + Math.cos(a + Math.PI / 2) * w * 0.5, y: this.cy + Math.sin(a + Math.PI / 2) * w * 0.5 };
      const p2 = { x: this.cx + Math.cos(a - Math.PI / 2) * w * 0.5, y: this.cy + Math.sin(a - Math.PI / 2) * w * 0.5 };
      const p3 = { x: p2.x + Math.cos(a) * size, y: p2.y + Math.sin(a) * size };
      const p4 = { x: p1.x + Math.cos(a) * size, y: p1.y + Math.sin(a) * size };
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.lineTo(p3.x, p3.y);
      g.lineTo(p4.x, p4.y);
      g.closePath();
      g.fillPath();
      g.strokePath();
    } else {
      // A mark above the head: unmistakable even in a crowd of rats.
      const mark = this.scene.add
        .image(this.cx, this.sprite.y - this.sprite.displayHeight - 6, FX.spark)
        .setTint(color)
        .setScale(1.4)
        .setDepth(7400);
      this.scene.tweens.add({
        targets: mark,
        scale: 2.2,
        alpha: 0.4,
        duration: this.def.windup * 1000,
        onComplete: () => mark.destroy(),
      });
    }

    const life =
      this.def.windup *
      1000 *
      (state.settings.longTelegraphs ? 1.3 : 1) *
      activeDifficulty(state.settings.difficulty).telegraph;
    this.scene.tweens.add({
      targets: g,
      alpha: 0.35,
      duration: life,
      onComplete: () => {
        g.destroy();
        if (this.telegraph === g) this.telegraph = undefined;
      },
    });
  }

  private clearTelegraph(): void {
    this.telegraph?.destroy();
    this.telegraph = undefined;
  }

  play(anim: 'idle' | 'run' | 'windup' | 'attack'): void {
    const key = `${ENEMY_SPRITE_KEY[this.def.id]}_${anim}`;
    if (!this.scene.anims.exists(key)) return;
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key, true);
  }

  destroy(): void {
    this.clearTelegraph();
    this.hpBar?.destroy();
    this.hpBarBack?.destroy();
    this.shadow.destroy();
    this.sprite.destroy();
  }
}

export type { EnemyId };
