import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import type { InputState } from '../core/InputSystem';
import { playerKeyFor, type Facing } from '../art/sprites/player';
import { FX } from '../art/sprites/fx';
import { hex, PAL } from '../art/palette';

type Action = 'idle' | 'walk' | 'dash' | 'attack' | 'hurt';

/**
 * PlayerController. Movement first: everything here exists to make the survivor feel
 * responsive before a single enemy is added.
 */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;

  facing: Facing = 'down';
  facingX = 0;
  facingY = 1;
  action: Action = 'idle';

  maxHp: number = BAL.player.baseMaxHp;
  hp: number = BAL.player.baseMaxHp;

  /** Read by CombatSystem in phase 2. */
  invulnUntil = 0;
  dashReadyAt = 0;
  lastDashAt = -9999;
  /** Set when a dash started inside an incoming hitbox. */
  perfectCritUntil = 0;

  private dashUntil = 0;
  private dashVec = new Phaser.Math.Vector2();
  private stepTimer = 0;
  private hurtUntil = 0;
  private trail: Phaser.GameObjects.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.sprite = scene.physics.add.sprite(x, y, playerKeyFor('down'));
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(y);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setCircle(
      BAL.player.bodyRadius,
      BAL.player.bodyOffset.x,
      BAL.player.bodyOffset.y,
    );
    this.body.setCollideWorldBounds(true);
    this.body.setMaxSpeed(600);

    this.play('idle');
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  /** Centre of the physics body, which is what combat and pickups should aim at. */
  get cx(): number {
    return this.body.center.x;
  }

  get cy(): number {
    return this.body.center.y;
  }

  get isDashing(): boolean {
    return this.scene.time.now < this.dashUntil;
  }

  get isInvulnerable(): boolean {
    return this.isDashing || this.scene.time.now < this.invulnUntil;
  }

  get dashCooldown(): number {
    return state.player.perks.quickstep > 0 ? BAL.dash.cooldownQuickStep : BAL.dash.cooldown;
  }

  /** 0 when ready, up to 1 right after dashing. Drives the HUD pip. */
  get dashCharge(): number {
    const remaining = this.dashReadyAt - this.scene.time.now;
    if (remaining <= 0) return 1;
    return 1 - remaining / (this.dashCooldown * 1000);
  }

  update(dt: number, input: InputState): void {
    const now = this.scene.time.now;
    const seconds = dt / 1000;

    if (this.isDashing) {
      this.body.setVelocity(this.dashVec.x, this.dashVec.y);
    } else {
      if (input.dashPressed && now >= this.dashReadyAt) {
        this.startDash(input);
      } else {
        this.steer(input, seconds);
      }
    }

    this.updateFacing(input);
    this.updateAnimation(input, now);
    this.footsteps(dt, input);

    this.sprite.setDepth(this.sprite.y);
  }

  private steer(input: InputState, seconds: number): void {
    const targetX = input.moveX * BAL.player.speed;
    const targetY = input.moveY * BAL.player.speed;
    const time = input.moving ? BAL.player.accelTime : BAL.player.stopTime;
    // Exponential approach: frame-rate independent and reaches full speed in a few frames.
    const t = 1 - Math.exp(-seconds / Math.max(0.001, time));
    this.body.setVelocity(
      Phaser.Math.Linear(this.body.velocity.x, targetX, t),
      Phaser.Math.Linear(this.body.velocity.y, targetY, t),
    );
  }

  private startDash(input: InputState): void {
    const now = this.scene.time.now;
    let dx = input.moveX;
    let dy = input.moveY;
    if (dx === 0 && dy === 0) {
      dx = this.facingX;
      dy = this.facingY;
    }
    const len = Math.hypot(dx, dy) || 1;
    const speed = BAL.dash.distance / BAL.dash.duration;
    this.dashVec.set((dx / len) * speed, (dy / len) * speed);

    this.dashUntil = now + BAL.dash.duration * 1000;
    this.dashReadyAt = now + this.dashCooldown * 1000;
    this.lastDashAt = now;
    this.action = 'dash';

    this.spawnAfterimages();
    this.snowBurst();
    bus.emit('player:dash', { perfect: false });
    bus.emit('audio:play', { cue: 'dash' });
  }

  /**
   * Called by CombatSystem when a dash began inside an active enemy hitbox. Rewards the
   * read with slow motion, a free dash and a guaranteed crit.
   */
  awardPerfectDodge(): void {
    const now = this.scene.time.now;
    this.dashReadyAt = now;
    this.perfectCritUntil = now + BAL.dash.perfectCritWindow * 1000;

    if (state.settings.shake > 0) {
      this.scene.time.timeScale = BAL.dash.perfectSlowMo;
      this.scene.tweens.timeScale = BAL.dash.perfectSlowMo;
      if (this.scene.physics?.world) {
        this.scene.physics.world.timeScale = 1 / BAL.dash.perfectSlowMo;
      }
      this.scene.time.delayedCall(BAL.dash.perfectSlowMoMs * BAL.dash.perfectSlowMo, () => {
        this.scene.time.timeScale = 1;
        this.scene.tweens.timeScale = 1;
        if (this.scene.physics?.world) this.scene.physics.world.timeScale = 1;
      });
    }
    bus.emit('player:dash', { perfect: true });
    bus.emit('audio:play', { cue: 'perfect' });
  }

  private spawnAfterimages(): void {
    for (let i = 0; i < BAL.dash.afterimages; i++) {
      this.scene.time.delayedCall((BAL.dash.duration * 1000 * i) / BAL.dash.afterimages, () => {
        if (!this.sprite.active) return;
        const ghost = this.scene.add
          .image(this.sprite.x, this.sprite.y, this.sprite.texture.key, this.sprite.frame.name)
          .setOrigin(0.5, 1)
          .setFlipX(this.sprite.flipX)
          .setTint(hex(PAL.cyan))
          .setAlpha(0.5)
          .setDepth(this.sprite.y - 1);
        this.trail.push(ghost);
        this.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          duration: 220,
          onComplete: () => {
            ghost.destroy();
            this.trail = this.trail.filter((g) => g !== ghost);
          },
        });
      });
    }
  }

  private snowBurst(): void {
    const emitter = this.scene.add.particles(this.cx, this.sprite.y - 2, FX.puff, {
      speed: { min: 20, max: 70 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 180, max: 340 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: hex(PAL.white),
      quantity: 6,
      emitting: false,
    });
    emitter.setDepth(this.sprite.y - 2);
    emitter.explode(6);
    this.scene.time.delayedCall(400, () => emitter.destroy());
  }

  private footsteps(dt: number, input: InputState): void {
    if (!input.moving || this.isDashing) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer += dt;
    if (this.stepTimer < 210) return;
    this.stepTimer = 0;

    const ember = state.player.cosmetics.trail === 'ember';
    const puff = this.scene.add
      .image(this.cx + Phaser.Math.Between(-2, 2), this.sprite.y - 1, FX.puff)
      .setTint(hex(ember ? PAL.orange : PAL.white))
      .setBlendMode(ember ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setAlpha(ember ? 0.8 : 0.55)
      .setDepth(this.sprite.y - 2);
    this.scene.tweens.add({
      targets: puff,
      alpha: 0,
      scale: 1.6,
      duration: 340,
      onComplete: () => puff.destroy(),
    });
    // A touch of pitch variation, so a long walk does not turn into a metronome.
    bus.emit('audio:play', { cue: 'step', volume: 0.85, rate: 0.9 + Math.random() * 0.25 });
  }

  private updateFacing(input: InputState): void {
    if (this.isDashing) return;
    if (input.moving) {
      this.facingX = input.moveX;
      this.facingY = input.moveY;
    }
    const ax = Math.abs(this.facingX);
    const ay = Math.abs(this.facingY);
    if (ax > ay * 0.9) {
      this.facing = 'side';
      this.sprite.setFlipX(this.facingX < 0);
    } else {
      this.facing = this.facingY < 0 ? 'up' : 'down';
      this.sprite.setFlipX(false);
    }
  }

  private updateAnimation(input: InputState, now: number): void {
    if (this.action === 'attack') return;
    if (now < this.hurtUntil) {
      this.action = 'hurt';
      return;
    }
    if (this.isDashing) {
      this.action = 'dash';
      this.play('walk');
      return;
    }
    const speed = this.body.velocity.length();
    this.action = speed > 12 ? 'walk' : 'idle';
    this.play(this.action === 'walk' ? 'walk' : 'idle');
    void input;
  }

  /** Swap texture and animation together, so changing direction never shows a wrong frame. */
  play(anim: 'idle' | 'walk' | 'attack'): void {
    const key = playerKeyFor(this.facing, state.player.cosmetics.outfit);
    const full = `${key}_${anim}`;
    if (this.sprite.texture.key !== key) {
      this.sprite.setTexture(key);
    }
    if (this.sprite.anims.currentAnim?.key !== full) {
      this.sprite.play(full, true);
    }
  }

  /** Returns true when the hit landed. Phase 2 calls this from CombatSystem. */
  takeDamage(amount: number, fromX: number, fromY: number, source = 'enemy'): boolean {
    const now = this.scene.time.now;
    if (this.isInvulnerable || this.hp <= 0) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = now + BAL.player.invulnAfterHit * 1000;
    this.hurtUntil = now + 180;

    const dx = this.cx - fromX;
    const dy = this.cy - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.body.setVelocity(
      (dx / len) * BAL.player.knockbackTaken,
      (dy / len) * BAL.player.knockbackTaken,
    );

    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => this.sprite.clearTint());
    this.blink();

    bus.emit('player:hit', { damage: amount, source });
    bus.emit('juice:shake', { intensity: 4, ms: 140 });
    bus.emit('audio:play', { cue: 'playerHurt' });

    if (this.hp <= 0) bus.emit('player:died', {});
    return true;
  }

  private blink(): void {
    const duration = BAL.player.invulnAfterHit * 1000;
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.35,
      duration: 90,
      yoyo: true,
      repeat: Math.floor(duration / 180),
      onComplete: () => this.sprite.setAlpha(1),
    });
  }

  heal(amount: number, source = 'food'): void {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (this.hp > before) bus.emit('player:heal', { amount: this.hp - before, source });
  }

  setMaxHp(value: number, healToFull = false): void {
    const delta = value - this.maxHp;
    this.maxHp = value;
    this.hp = healToFull ? value : Math.min(value, this.hp + Math.max(0, delta));
  }

  destroy(): void {
    for (const ghost of this.trail) ghost.destroy();
    this.trail.length = 0;
    this.sprite.destroy();
  }
}
