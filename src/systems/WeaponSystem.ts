import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state, type WeaponInstance } from '../core/GameState';
import { BAL } from '../data/balance';
import {
  BRANCHES,
  MODIFIERS,
  REINFORCE_DAMAGE,
  WEAPONS,
  type WeaponDef,
  type WeaponId,
  type SwingShape,
} from '../data/weapons';
import { hex, RARITY_COLOR, PAL } from '../art/palette';
import { WFX } from '../art/sprites/weapons';
import type { CombatSystem } from './CombatSystem';
import type { Player } from '../entities/Player';
import type { InputState } from '../core/InputSystem';
import { hud } from '../core/HudState';

type Phase = 'ready' | 'windup' | 'active' | 'recovery';

/** A weapon instance resolved into the numbers combat actually uses. */
export interface ResolvedWeapon {
  def: WeaponDef;
  instance: WeaponInstance;
  name: string;
  color: string;
  damage: number[];
  knockback: number;
  crit: number;
  reach: number;
  hitStun: number;
  pierce: boolean;
  charges: number;
  flags: string[];
}

/**
 * Owns the swing: timing, combos, the charged attack, the visual arc, and turning a
 * saved WeaponInstance into live numbers.
 */
export class WeaponSystem {
  private phase: Phase = 'ready';
  private phaseUntil = 0;
  private comboStep = 0;
  private comboUntil = 0;
  private charging = false;
  private chargeStart = 0;
  private queuedCharged = false;
  /** When the attack button went down, while it is still undecided between tap and hold. */
  private pressAt = -1;
  /** A tap waiting for the swing to be free. */
  private tapQueued = false;
  private tapQueuedAt = 0;
  private chargeBar?: Phaser.GameObjects.Rectangle;
  private chargeBarBack?: Phaser.GameObjects.Rectangle;
  private aimX = 1;
  private aimY = 0;

  /** Ranged charges, keyed by weapon uid. */
  private ammo = new Map<string, number>();
  private ammoAt = new Map<string, number>();

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private combat: CombatSystem,
  ) {}

  // --- resolving instances ----------------------------------------------

  static resolve(instance: WeaponInstance): ResolvedWeapon {
    const def = WEAPONS[instance.base as WeaponId] ?? WEAPONS.axe;
    const branch = instance.branch
      ? BRANCHES[def.id].find((b) => b.id === instance.branch)
      : undefined;

    let mult = instance.tier >= 1 ? REINFORCE_DAMAGE : 1;
    mult *= branch?.damageMult ?? 1;

    let crit = def.crit + (branch?.critAdd ?? 0);
    let knockback = def.knockback * (branch?.knockbackMult ?? 1);
    const flags = [...(branch?.flags ?? []), ...instance.mods];

    for (const mod of instance.mods) {
      if (mod === 'keen') crit += 0.1;
      if (mod === 'brutal') knockback *= 1.3;
      if (mod === 'burning') mult *= 1.05;
    }

    const name = branch?.name ?? (instance.tier >= 1 ? `Reinforced ${def.name}` : def.name);

    return {
      def,
      instance,
      name,
      color: instance.rarity === 'common' ? def.color : RARITY_COLOR[instance.rarity],
      damage: def.damage.map((d) => Math.max(1, Math.round(d * mult))),
      knockback,
      crit,
      reach: def.reach + (branch?.reachAdd ?? 0),
      hitStun: branch?.hitStun ?? def.hitStun,
      pierce: def.pierce || flags.includes('pierce'),
      charges: def.charges + (branch?.chargesAdd ?? 0),
      flags,
    };
  }

  get equipped(): ResolvedWeapon {
    const slot = state.player.activeSlot ?? 0;
    const uid = state.player.equipped[slot] ?? state.player.equipped[0];
    const instance =
      state.player.weapons.find((w) => w.uid === uid) ?? state.player.weapons[0];
    return WeaponSystem.resolve(instance);
  }

  get secondary(): ResolvedWeapon | null {
    const uid = state.player.equipped[1];
    if (!uid) return null;
    const instance = state.player.weapons.find((w) => w.uid === uid);
    return instance ? WeaponSystem.resolve(instance) : null;
  }

  swap(): void {
    this.select(state.player.activeSlot === 0 ? 2 : 1);
  }

  /** Put slot 1 or 2 in the hand, if there is something in it. */
  select(slot: 1 | 2): void {
    const index = (slot - 1) as 0 | 1;
    if (!state.player.equipped[index]) return;
    if (state.player.activeSlot === index) return;
    state.player.activeSlot = index;
    this.reset();
    bus.emit('audio:play', { cue: 'swap' });
  }

  get busy(): boolean {
    return this.phase !== 'ready';
  }

  // --- loop --------------------------------------------------------------

  update(dt: number, input: InputState): void {
    const now = this.scene.time.now;
    const w = this.equipped;

    if (input.moving || this.phase === 'ready') {
      // Aim follows the cursor or stick; when idle it keeps the last direction.
      this.aimX = input.aimX;
      this.aimY = input.aimY;
    }
    if (this.phase === 'ready' && !input.moving) {
      this.aimX = input.aimX;
      this.aimY = input.aimY;
    }

    this.regenerateAmmo(w, now);

    switch (this.phase) {
      case 'windup':
        if (now >= this.phaseUntil) this.beginActive(w);
        break;
      case 'active':
        if (now >= this.phaseUntil) {
          this.phase = 'recovery';
          this.phaseUntil = now + w.def.recovery * 1000;
        }
        break;
      case 'recovery':
        if (now >= this.phaseUntil) this.phase = 'ready';
        break;
    }

    if (now > this.comboUntil) this.comboStep = 0;

    this.handleCharge(input, now, w);

    if (this.phase === 'ready') {
      if (this.queuedCharged) {
        this.queuedCharged = false;
        this.beginSwing(w, true);
      } else if (this.tapQueued) {
        this.tapQueued = false;
        if (now - this.tapQueuedAt <= BAL.inputBufferMs) this.beginSwing(w, false);
      }
    }

    hud.weaponName = w.name.toUpperCase();
    hud.weaponColor = w.color;
    hud.comboCount = this.comboStep;
    void dt;
  }

  /**
   * A press is either a tap or a hold, never both. It is undecided until it has
   * been held for `holdToCharge`; released before that it is a tap, held past it
   * it starts charging. Letting go of a charge before it is full still swings, so
   * a nervous half-hold is never a wasted press.
   */
  private handleCharge(input: InputState, now: number, w: ResolvedWeapon): void {
    const holdMs = BAL.combat.holdToCharge * 1000;

    if (input.attackPressed) this.pressAt = now;

    if (this.pressAt >= 0) {
      if (!input.attackHeld) {
        this.pressAt = -1;
        this.tapQueued = true;
        this.tapQueuedAt = now;
      } else if (now - this.pressAt >= holdMs && this.phase === 'ready') {
        this.pressAt = -1;
        this.charging = true;
        this.chargeStart = now;
      }
    }

    if (!this.charging) return;

    const t = Phaser.Math.Clamp((now - this.chargeStart) / (BAL.combat.chargeTime * 1000), 0, 1);
    if (input.attackHeld) {
      hud.chargeAmount = t;
      this.drawChargeBar(t);
      return;
    }

    this.charging = false;
    hud.chargeAmount = 0;
    this.hideChargeBar();
    if (t >= 1) {
      this.queuedCharged = true;
    } else {
      this.tapQueued = true;
      this.tapQueuedAt = now;
    }
    void w;
  }

  private drawChargeBar(t: number): void {
    const x = Math.round(this.player.cx) - 10;
    const y = Math.round(this.player.sprite.y) - this.player.sprite.height - 6;
    if (!this.chargeBarBack) {
      this.chargeBarBack = this.scene.add.rectangle(x, y, 20, 3, 0x0a1030).setOrigin(0).setDepth(7400);
      this.chargeBar = this.scene.add.rectangle(x, y, 0, 3, hex(this.equipped.color)).setOrigin(0).setDepth(7401);
    }
    this.chargeBarBack.setPosition(x, y).setVisible(t > 0.05);
    this.chargeBar!.setPosition(x, y).setVisible(t > 0.05);
    this.chargeBar!.width = Math.round(20 * t);
    this.chargeBar!.setFillStyle(hex(t >= 1 ? '#ffffff' : this.equipped.color));
  }

  private hideChargeBar(): void {
    this.chargeBarBack?.setVisible(false);
    this.chargeBar?.setVisible(false);
  }

  // --- swinging ----------------------------------------------------------

  private pendingCharged = false;

  private beginSwing(w: ResolvedWeapon, charged: boolean): void {
    if (w.def.shape === 'ranged' && this.ammoFor(w) <= 0) {
      bus.emit('audio:play', { cue: 'empty', volume: 0.4 });
      return;
    }

    const now = this.scene.time.now;
    this.pendingCharged = charged;
    this.phase = 'windup';
    this.phaseUntil = now + w.def.windup * 1000 * (charged ? 1.4 : 1);
    this.player.play('attack');
    this.player.action = 'attack';
    // Face the swing, so the player always hits where they are looking.
    this.player.facingX = this.aimX;
    this.player.facingY = this.aimY;
    bus.emit('player:attack', { weaponId: w.def.id, charged });
  }

  private beginActive(w: ResolvedWeapon): void {
    const now = this.scene.time.now;
    this.phase = 'active';
    this.phaseUntil = now + w.def.active * 1000;
    this.player.action = 'idle';

    const charged = this.pendingCharged;
    const step = Math.min(this.comboStep, w.damage.length - 1);
    const isFinisher = step === w.damage.length - 1;

    let damage = w.damage[step];
    let knockback = w.knockback;
    let arcDeg = w.def.arcDeg;
    let reach = w.reach;
    let shape = w.def.shape;
    let pierce = w.pierce;
    let extraStun = 0;
    let thrustWidth = w.def.thrustWidth;

    if (charged) {
      // Each weapon's own move. The multiplier is the floor, the shape is the point.
      damage = Math.round(damage * BAL.combat.chargeDamageMult);
      knockback *= BAL.combat.chargeKnockbackMult;
      switch (w.def.id) {
        case 'axe':
          shape = 'circle';
          arcDeg = 360;
          reach += 8;
          damage = Math.round(damage * 0.8);
          break;
        case 'knife': {
          // A step in first, so the stab lands where the enemy is about to be.
          const step = 28;
          this.player.sprite.setPosition(this.player.sprite.x + this.aimX * step, this.player.sprite.y + this.aimY * step);
          this.player.body.reset(this.player.sprite.x, this.player.sprite.y);
          shape = 'thrust';
          thrustWidth = 16;
          reach = 30;
          damage = Math.round(damage * 1.2);
          break;
        }
        case 'spear':
          reach = w.reach * 2;
          pierce = true;
          extraStun = 0.35;
          break;
        case 'hammer':
          shape = 'circle';
          reach = 60;
          extraStun = 0.6;
          break;
        case 'antler':
          shape = 'circle';
          reach = 46;
          damage = Math.round(damage * 0.7);
          break;
        default:
          arcDeg = Math.min(360, arcDeg * 1.35);
          reach += 6;
      }
    }

    if (w.def.shape === 'ranged') {
      if (charged) {
        // A volley: three arrows in a fan, one charge's worth of ammo.
        const ax = this.aimX;
        const ay = this.aimY;
        for (const off of [-0.22, 0, 0.22]) {
          const a = Math.atan2(ay, ax) + off;
          this.aimX = Math.cos(a);
          this.aimY = Math.sin(a);
          this.fireProjectile(w, Math.round(damage * 0.6), off === 0);
          this.ammo.set(w.instance.uid, this.ammoFor(w) + 1);
        }
        this.ammo.set(w.instance.uid, Math.max(0, this.ammoFor(w) - 1));
        this.aimX = ax;
        this.aimY = ay;
      } else {
        this.fireProjectile(w, damage, charged);
      }
    } else {
      const result = this.combat.strike({
        x: this.player.cx,
        y: this.player.cy,
        dirX: this.aimX,
        dirY: this.aimY,
        weapon: w.def,
        damage,
        knockback,
        crit: w.crit,
        reach,
        shape,
        arcDeg,
        thrustWidth,
        pierce,
        stun: w.hitStun + extraStun + (isFinisher ? w.def.finisherStun : 0),
        flags: w.flags,
      });

      if (result.hits > 0) {
        this.comboStep = (this.comboStep + 1) % w.damage.length;
        this.comboUntil = now + w.def.comboWindow * 1000 + w.def.recovery * 1000;
      } else {
        bus.emit('audio:play', { cue: 'whiff', volume: 0.3 });
      }
      this.spawnSwingFx(w, charged, arcDeg, reach, shape);
    }

    if (charged) bus.emit('juice:shake', { intensity: 3, ms: 110 });
  }

  private spawnSwingFx(w: ResolvedWeapon, charged: boolean, arcDeg: number, reach: number, shape: SwingShape = w.def.shape): void {
    const angle = Math.atan2(this.aimY, this.aimX);
    const cx = this.player.cx + Math.cos(angle) * 4;
    const cy = this.player.cy + Math.sin(angle) * 4;

    if (shape === 'thrust') {
      const fx = this.scene.add
        .image(cx, cy, WFX.thrust)
        .setOrigin(0, 0.5)
        .setRotation(angle)
        .setTint(hex(w.color))
        .setDepth(this.player.sprite.y + 1)
        .setScale(0.2, charged ? 1.6 : 1.2)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: fx,
        scaleX: reach / 16,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeOut',
        onComplete: () => fx.destroy(),
      });
      return;
    }

    if (shape === 'circle') {
      // The blade goes the whole way round: a wide arc that spins a full turn,
      // starting from wherever the player is aiming.
      const cx = this.player.cx;
      const cy = this.player.cy;
      const angle = Math.atan2(this.aimY, this.aimX);
      const blade = this.scene.add
        .image(cx, cy, WFX.arcWide)
        .setRotation(angle)
        .setTint(hex(charged ? '#ffffff' : skinColour(w.color)))
        .setDepth(this.player.sprite.y + 1)
        .setScale((reach * 2.1) / 64)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: blade,
        rotation: angle + Math.PI * 2,
        duration: charged ? 300 : 220,
        ease: 'Quad.easeOut',
        onComplete: () => blade.destroy(),
      });
      this.scene.tweens.add({ targets: blade, alpha: 0, delay: 120, duration: charged ? 180 : 100 });
      bus.emit('audio:play', { cue: charged ? 'swingHeavy' : `swing-${w.def.id}` });

      const fx = this.scene.add
        .image(this.player.cx, this.player.cy, WFX.shock)
        .setTint(hex(w.color))
        .setDepth(this.player.sprite.y - 1)
        .setScale(0.2)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: fx,
        scale: (reach * 2) / 80,
        alpha: 0,
        duration: 260,
        ease: 'Cubic.easeOut',
        onComplete: () => fx.destroy(),
      });
      return;
    }

    const key = arcDeg > 90 ? WFX.arcWide : WFX.arcNarrow;
    const size = key === WFX.arcWide ? 64 : 44;
    const fx = this.scene.add
      .image(cx, cy, key)
      .setRotation(angle - 0.5)
      .setTint(hex(charged ? '#ffffff' : skinColour(w.color)))
      .setDepth(this.player.sprite.y + 1)
      .setScale((reach * 2.1) / size)
      .setBlendMode(Phaser.BlendModes.ADD);

    // The arc sweeps through the swing rather than appearing flat.
    this.scene.tweens.add({
      targets: fx,
      rotation: angle + 0.5,
      alpha: 0,
      duration: charged ? 200 : 140,
      ease: 'Quad.easeOut',
      onComplete: () => fx.destroy(),
    });
    bus.emit('audio:play', { cue: charged ? 'swingHeavy' : `swing-${w.def.id}` });
  }

  // --- ranged ------------------------------------------------------------

  private ammoFor(w: ResolvedWeapon): number {
    if (w.def.shape !== 'ranged') return 1;
    const current = this.ammo.get(w.instance.uid);
    if (current === undefined) {
      this.ammo.set(w.instance.uid, w.charges);
      return w.charges;
    }
    return current;
  }

  private regenerateAmmo(w: ResolvedWeapon, now: number): void {
    if (w.def.shape !== 'ranged') return;
    const rate = w.def.rechargeSec * (w.flags.includes('fastRecharge') ? 0.6 : 1) * 1000;
    const last = this.ammoAt.get(w.instance.uid) ?? now;
    if (now - last < rate) return;
    this.ammoAt.set(w.instance.uid, now);
    const current = this.ammoFor(w);
    if (current < w.charges) this.ammo.set(w.instance.uid, current + 1);
  }

  private fireProjectile(w: ResolvedWeapon, damage: number, charged: boolean): void {
    this.ammo.set(w.instance.uid, Math.max(0, this.ammoFor(w) - 1));
    this.ammoAt.set(w.instance.uid, this.scene.time.now);
    bus.emit('audio:play', { cue: 'bow' });

    const angle = Math.atan2(this.aimY, this.aimX);
    const shot = this.scene.add
      .image(this.player.cx, this.player.cy, WFX.arrow)
      .setRotation(angle)
      .setTint(hex(w.color))
      .setDepth(this.player.sprite.y + 1)
      .setScale(charged ? 1.6 : 1.2);

    const speed = w.def.projectileSpeed;
    const range = w.def.reach;
    const startX = shot.x;
    const startY = shot.y;
    const hitOnce = new Set<string>();

    const tick = () => {
      if (!shot.active) return;
      shot.x += Math.cos(angle) * speed * (1 / 60);
      shot.y += Math.sin(angle) * speed * (1 / 60);
      shot.setDepth(shot.y + 1);

      for (const enemy of this.combat.list) {
        if (!enemy.alive || hitOnce.has(enemy.id)) continue;
        if (Math.hypot(enemy.cx - shot.x, enemy.cy - shot.y) > 12) continue;
        hitOnce.add(enemy.id);
        const crit = Math.random() < w.crit;
        enemy.takeDamage(
          Math.max(1, Math.round(damage * this.combat.damageMultiplier() * (crit ? BAL.combat.critMultiplier : 1))),
          startX,
          startY,
          w.knockback,
          crit,
        );
        if (w.def.slow) enemy.applySlow(w.def.slow.amount, w.def.slow.seconds);
        if (!charged) {
          shot.destroy();
          return;
        }
      }

      if (Math.hypot(shot.x - startX, shot.y - startY) > range) {
        shot.destroy();
        return;
      }
      this.scene.time.delayedCall(16, tick);
    };
    tick();
  }

  reset(): void {
    this.phase = 'ready';
    this.comboStep = 0;
    this.charging = false;
    this.queuedCharged = false;
    this.hideChargeBar();
  }

  destroy(): void {
    this.chargeBar?.destroy();
    this.chargeBarBack?.destroy();
    void MODIFIERS;
  }
}

/** The bone skin turns every swing pale, whatever the weapon's own colour. */
function skinColour(colour: string): string {
  return state.player.cosmetics.weaponSkin === 'bone' ? PAL.cream : colour;
}
