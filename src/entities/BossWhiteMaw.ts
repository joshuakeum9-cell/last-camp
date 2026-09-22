import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL } from '../data/balance';
import { activeDifficulty } from '../data/difficulty';
import { PixelFactory, bob } from '../art/PixelFactory';
import type { PixelSprite } from '../art/PixelFactory';
import { hex, PAL } from '../art/palette';
import { FX } from '../art/sprites/fx';
import { WFX } from '../art/sprites/weapons';
import { Juice } from '../systems/Juice';
import type { Player } from './Player';
import type { Boss } from './Boss';

const P: Record<string, string | null> = {
  '.': null,
  o: '#0a1030',
  w: 'white',
  W: '#eef7ff',
  S: 'greyDark',
  s: 'snowShade',
  e: 'blood',
  y: 'gold',
  m: '#5c1020',
  r: '#9e1b32',
};

const MAW = [
  '..oo........................oo..',
  '.oSSo......................oSSo.',
  '.oSSSo....................oSSSo.',
  '..oSSSo..oooooooooooooo..oSSSo..',
  '...oSSooWWWWWWWWWWWWWWWooSSSo...',
  '....oSoWWWWWWWWWWWWWWWWWWoSSo...',
  '....ooWWWWWWWWWWWWWWWWWWWWWoo...',
  '...oWWWWWWWWWWWWWWWWWWWWWWWWo...',
  '..oWWWWWWWWWWWWWWWWWWWWWWWWWWo..',
  '..oWWWoooWWWWWWWWWWWWoooWWWWWo..',
  '..oWWoeeeoWWWWWWWWWWoeeeoWWWWo..',
  '..oWWoeyeoWWWWWWWWWWoeyeoWWWWo..',
  '..oWWoeeeoWWWWWWWWWWoeeeoWWWWo..',
  '..oWWWoooWWWWWWWWWWWWoooWWWWWo..',
  '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.',
  '.oWWWWWooooooooooooooooooWWWWWo.',
  '.oWWWWormmmmmmmmmmmmmmmroWWWWWo.',
  '.oWWWWrwmwmwmwmwmwmwmwmrWWWWWWo.',
  '.oWWWormwmwmwmwmwmwmwmwmroWWWWo.',
  '.oWWWormmmmmmmmmmmmmmmmmroWWWWo.',
  '.oWWWormmmmmmmmmmmmmmmmmroWWWWo.',
  '.oWWWormwmwmwmwmwmwmwmwmroWWWWo.',
  '.oWWWWrwmwmwmwmwmwmwmwmrWWWWWWo.',
  '..oWWWormmmmmmmmmmmmmmroWWWWWo..',
  '..oWWWWooooooooooooooooWWWWWWo..',
  '...oWWWWWWWWWWWWWWWWWWWWWWWWo...',
  '....oWWWWWWWWWWWWWWWWWWWWWWo....',
  '.....oWWWWWoo......ooWWWWWWo....',
  '......oWWWo..........oWWWWo.....',
  '.....oWWWWo..........oWWWWo.....',
  '.....oWWSSo..........oWWSSo.....',
  '.....oooooo..........oooooo.....',
];

const MAW_ROAR = [
  '..oo........................oo..',
  '.oSSo......................oSSo.',
  'oSSSSo....................oSSSSo',
  '.oSSSSo..oooooooooooooo..oSSSSo.',
  '..oSSoWWWWWWWWWWWWWWWWWWooSSSo..',
  '...ooWWWWWWWWWWWWWWWWWWWWWWoo...',
  '..oWWWWWWWWWWWWWWWWWWWWWWWWWWo..',
  '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.',
  '.oWWWoooooWWWWWWWWWWoooooWWWWWo.',
  '.oWWoeeeeeoWWWWWWWWoeeeeeoWWWWo.',
  '.oWWoeyyyeoWWWWWWWWoeyyyeoWWWWo.',
  '.oWWoeyyyeoWWWWWWWWoeyyyeoWWWWo.',
  '.oWWoeeeeeoWWWWWWWWoeeeeeoWWWWo.',
  '.oWWWoooooWWWWWWWWWWoooooWWWWWo.',
  'oWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWo',
  'oWWWoooooooooooooooooooooooWWWWo',
  'oWWormmmmmmmmmmmmmmmmmmmmmroWWWo',
  'oWWrwmwmwmwmwmwmwmwmwmwmwmwrWWWo',
  'oWormwmwmwmwmwmwmwmwmwmwmwmwroWo',
  'oWormmmmmmmmmmmmmmmmmmmmmmmmroWo',
  'oWorrmmmmmmmmmmmmmmmmmmmmmmrroWo',
  'oWormmmmmmmmmmmmmmmmmmmmmmmmroWo',
  'oWormwmwmwmwmwmwmwmwmwmwmwmwroWo',
  'oWWrwmwmwmwmwmwmwmwmwmwmwmwrWWWo',
  'oWWormmmmmmmmmmmmmmmmmmmmmroWWWo',
  'oWWWoooooooooooooooooooooooWWWWo',
  '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.',
  '..oWWWWWoo............ooWWWWWo..',
  '...oWWWo................oWWWo...',
  '..oWWWWo................oWWWWo..',
  '..oWWSSo................oWWSSo..',
  '..oooooo................oooooo..',
];

export const mawSprite: PixelSprite = {
  key: 'boss-maw',
  fps: 4,
  palette: P,
  anims: {
    idle: [MAW, bob(MAW, 1)],
    run: [MAW, bob(MAW, 1), MAW, bob(MAW, 2)],
    roar: [MAW_ROAR, bob(MAW_ROAR, 1)],
  },
  fpsOverride: { idle: 2, run: 6, roar: 8 },
};

export function buildMawArt(scene: Phaser.Scene): void {
  PixelFactory.build(scene, mawSprite);
}

type Pattern = 'charge' | 'slam' | 'howl';
type MawState = 'idle' | 'stalk' | 'telegraph' | 'act' | 'recover' | 'stunned' | 'dead';

export interface MawHitbox {
  x: number;
  y: number;
  radius: number;
  damage: number;
  until: number;
  spent: boolean;
  bornAt: number;
}

/**
 * The White Maw. Three readable patterns and one phase change. Nothing about it is
 * difficult because of its health bar: every pattern has a tell, and every pattern has
 * a window afterwards that belongs to the player.
 */
export class BossWhiteMaw implements Boss {
  readonly name = 'The White Maw';
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly id = 'maw';

  maxHp: number;
  hp: number;
  damage: number;
  state: MawState = 'idle';
  hitbox: MawHitbox | null = null;
  phase2 = false;

  private pattern: Pattern = 'charge';
  private stateUntil = 0;
  private nextActionAt = 0;
  private chargeDir = { x: 1, y: 0 };
  private chargesLeft = 1;
  private telegraph?: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private markers: Phaser.GameObjects.Image[] = [];
  private lastPattern: Pattern | null = null;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private player: Player,
    private juice: Juice,
    private spawnRats: (x: number, y: number, count: number) => void,
  ) {
    const diff = activeDifficulty(state.settings.difficulty);
    this.maxHp = Math.round(600 * diff.enemyHp);
    this.hp = this.maxHp;
    this.damage = Math.round(24 * diff.enemyDamage);

    this.shadow = scene.add
      .ellipse(x, y - 2, 70, 22, hex(PAL.blue))
      .setAlpha(0.35)
      .setDepth(y - 2);

    this.sprite = scene.physics.add.sprite(x, y, mawSprite.key);
    this.sprite.setOrigin(0.5, 1).setScale(2).setDepth(y);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(44, 20);
    this.body.setOffset((this.sprite.width - 44) / 2, this.sprite.height - 20);
    this.body.setCollideWorldBounds(true);
    this.body.setMass(8);

    this.sprite.play(`${mawSprite.key}_idle`);
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

  private get now(): number {
    return this.scene.time.now;
  }

  // --- loop --------------------------------------------------------------

  update(dt: number): void {
    if (!this.alive) return;
    const px = this.player.cx;
    const py = this.player.cy;
    const dx = px - this.cx;
    const dy = py - this.cy;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;

    switch (this.state) {
      case 'idle':
        if (dist < 260) this.enter('stalk');
        break;

      case 'stalk': {
        // Circles just out of reach, closing slowly. The pressure is the point.
        const speed = this.phase2 ? 86 : 66;
        const side = { x: -dirY, y: dirX };
        this.body.setVelocity(
          (dirX * 0.6 + side.x * 0.5) * speed,
          (dirY * 0.6 + side.y * 0.5) * speed,
        );
        this.sprite.play(`${mawSprite.key}_run`, true);
        if (this.now >= this.nextActionAt) this.choosePattern(dist, dirX, dirY);
        break;
      }

      case 'telegraph':
        this.body.setVelocity(0, 0);
        if (this.pattern === 'charge' && this.telegraphProgress() > 0.8) {
          this.chargeDir = { x: dirX, y: dirY };
        }
        if (this.now >= this.stateUntil) this.act();
        break;

      case 'act':
        this.runPattern();
        if (this.now >= this.stateUntil) this.finishPattern();
        break;

      case 'recover':
        this.body.setVelocity(this.body.velocity.x * 0.85, this.body.velocity.y * 0.85);
        this.sprite.play(`${mawSprite.key}_idle`, true);
        if (this.now >= this.stateUntil) this.enter('stalk');
        break;

      case 'stunned':
        this.body.setVelocity(0, 0);
        if (this.now >= this.stateUntil) this.enter('stalk');
        break;
    }

    this.sync();
    void dt;
  }

  private telegraphProgress(): number {
    const total = this.telegraphTime();
    return Phaser.Math.Clamp(1 - (this.stateUntil - this.now) / total, 0, 1);
  }

  private telegraphTime(): number {
    const base = this.pattern === 'charge' ? 800 : this.pattern === 'slam' ? 1000 : 700;
    const scaled =
      (this.phase2 ? base * 0.8 : base) * activeDifficulty(state.settings.difficulty).telegraph;
    return state.settings.longTelegraphs ? scaled * 1.3 : scaled;
  }

  private choosePattern(dist: number, dirX: number, dirY: number): void {
    // Never the same pattern twice running: the fight has to keep asking new questions.
    const options: Pattern[] = ['charge', 'slam', 'howl'];
    const allowed = options.filter((p) => p !== this.lastPattern);
    let pick = allowed[Math.floor(Math.random() * allowed.length)];
    if (dist > 150 && allowed.includes('charge')) pick = 'charge';
    if (dist < 50 && allowed.includes('slam')) pick = 'slam';

    this.pattern = pick;
    this.lastPattern = pick;
    this.chargeDir = { x: dirX, y: dirY };
    this.chargesLeft = pick === 'charge' && this.phase2 ? 2 : 1;
    this.enter('telegraph');
  }

  private enter(next: MawState): void {
    this.state = next;
    switch (next) {
      case 'telegraph':
        this.stateUntil = this.now + this.telegraphTime();
        this.showTelegraph();
        this.sprite.play(`${mawSprite.key}_roar`, true);
        bus.emit('audio:play', { cue: `maw-${this.pattern}` });
        break;
      case 'act':
        this.stateUntil = this.now + (this.pattern === 'charge' ? 900 : 400);
        this.clearTelegraph();
        this.sprite.play(`${mawSprite.key}_run`, true);
        break;
      case 'recover':
        this.stateUntil = this.now + (this.pattern === 'charge' ? 1200 : 700);
        this.hitbox = null;
        this.nextActionAt = this.stateUntil + (this.phase2 ? 200 : 500);
        break;
      case 'stunned':
        this.stateUntil = this.now + 1200;
        this.hitbox = null;
        this.nextActionAt = this.stateUntil + 300;
        break;
    }
  }

  private act(): void {
    this.enter('act');
    const now = this.now;

    if (this.pattern === 'charge') {
      bus.emit('audio:play', { cue: 'mawCharge' });
      this.hitbox = {
        x: this.cx,
        y: this.cy,
        radius: 30,
        damage: this.damage,
        until: now + 900,
        spent: false,
        bornAt: now,
      };
      return;
    }

    if (this.pattern === 'slam') {
      // The ring lands where the outline was drawn. Outside it is safe, inside is not.
      const radius = 62;
      this.hitbox = {
        x: this.cx,
        y: this.cy,
        radius,
        damage: this.damage,
        until: now + 260,
        spent: false,
        bornAt: now,
      };
      const shock = this.scene.add
        .image(this.cx, this.cy, WFX.shock)
        .setTint(hex(PAL.cyan))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.3)
        .setDepth(this.sprite.y - 1);
      this.scene.tweens.add({
        targets: shock,
        scale: (radius * 2) / 80,
        alpha: 0,
        duration: 300,
        onComplete: () => shock.destroy(),
      });
      bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 220 });
      bus.emit('audio:play', { cue: 'mawSlam' });
      return;
    }

    // Howl: rats now, icicles on the markers a moment later.
    this.spawnRats(this.cx, this.cy, 3);
    bus.emit('audio:play', { cue: 'mawHowl' });
    for (const marker of this.markers) {
      const x = marker.x;
      const y = marker.y;
      this.scene.time.delayedCall(1200, () => {
        const icicle = this.scene.add
          .image(x, y - 90, WFX.icicle)
          .setScale(2)
          .setTint(hex(PAL.ice))
          .setDepth(y + 2);
        this.scene.tweens.add({
          targets: icicle,
          y,
          duration: 220,
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.juice.sparks(x, y, PAL.cyan, 8, 110);
            bus.emit('juice:shake', { intensity: 2, ms: 90 });
            if (Phaser.Math.Distance.Between(this.player.cx, this.player.cy, x, y) < 20) {
              this.player.takeDamage(Math.round(this.damage * 0.6), x, y, 'icicle');
            }
            icicle.destroy();
          },
        });
      });
    }
  }

  private runPattern(): void {
    if (this.pattern !== 'charge' || !this.hitbox) return;
    const speed = this.phase2 ? 340 : 300;
    this.body.setVelocity(this.chargeDir.x * speed, this.chargeDir.y * speed);
    this.hitbox.x = this.cx;
    this.hitbox.y = this.cy;

    // Hitting a wall is what opens the window. The charge is a commitment.
    if (this.body.blocked.left || this.body.blocked.right || this.body.blocked.up || this.body.blocked.down) {
      this.stateUntil = this.now;
      this.wallSlam();
    }
  }

  private wallSlam(): void {
    this.hitbox = null;
    this.juice.sparks(this.cx, this.cy, PAL.white, 18, 180);
    this.juice.ring(this.cx, this.cy, PAL.white, 56, 420);
    bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 300 });
    bus.emit('audio:play', { cue: 'mawStun' });
    this.chargesLeft = 0;
    this.enter('stunned');
  }

  private finishPattern(): void {
    if (this.pattern === 'charge' && this.chargesLeft > 1) {
      this.chargesLeft--;
      const dx = this.player.cx - this.cx;
      const dy = this.player.cy - this.cy;
      const len = Math.hypot(dx, dy) || 1;
      this.chargeDir = { x: dx / len, y: dy / len };
      this.enter('telegraph');
      this.stateUntil = this.now + 320;
      return;
    }
    this.enter('recover');
  }

  // --- telegraphs --------------------------------------------------------

  private showTelegraph(): void {
    this.clearTelegraph();
    const g = this.scene.add.graphics().setDepth(1);
    this.telegraph = g;
    const color = hex(PAL.blood);

    if (this.pattern === 'charge') {
      const a = Math.atan2(this.chargeDir.y, this.chargeDir.x);
      const w = 52;
      const len = 220;
      g.fillStyle(color, 0.18);
      g.lineStyle(2, color, 0.85);
      const p1 = { x: this.cx + Math.cos(a + Math.PI / 2) * w * 0.5, y: this.cy + Math.sin(a + Math.PI / 2) * w * 0.5 };
      const p2 = { x: this.cx + Math.cos(a - Math.PI / 2) * w * 0.5, y: this.cy + Math.sin(a - Math.PI / 2) * w * 0.5 };
      const p3 = { x: p2.x + Math.cos(a) * len, y: p2.y + Math.sin(a) * len };
      const p4 = { x: p1.x + Math.cos(a) * len, y: p1.y + Math.sin(a) * len };
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      g.lineTo(p2.x, p2.y);
      g.lineTo(p3.x, p3.y);
      g.lineTo(p4.x, p4.y);
      g.closePath();
      g.fillPath();
      g.strokePath();
    } else if (this.pattern === 'slam') {
      g.lineStyle(3, color, 0.9);
      g.strokeEllipse(this.cx, this.cy, 124, 70);
      g.fillStyle(color, 0.14);
      g.fillEllipse(this.cx, this.cy, 124, 70);
    } else {
      // Four ground markers, so the howl is a place as well as a sound.
      for (const m of this.markers) m.destroy();
      this.markers = [];
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = 40 + Math.random() * 70;
        const x = this.player.cx + Math.cos(angle) * r;
        const y = this.player.cy + Math.sin(angle) * r;
        const marker = this.scene.add
          .image(x, y, FX.ring)
          .setTint(color)
          .setScale(0.5)
          .setAlpha(0.8)
          .setDepth(1);
        this.markers.push(marker);
        this.scene.time.delayedCall(2200, () => marker.destroy());
      }
    }

    this.scene.tweens.add({
      targets: g,
      alpha: 0.3,
      duration: this.telegraphTime(),
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

  // --- damage ------------------------------------------------------------

  takeDamage(amount: number, fromX: number, fromY: number, knockback: number, crit: boolean): number {
    if (!this.alive) return 0;
    this.hp -= amount;

    Juice.flashSprite(this.scene, this.sprite);
    this.juice.floatNumber(this.cx, this.sprite.y - this.sprite.displayHeight * 0.8, amount, crit ? 'crit' : 'normal');
    this.juice.sparks(this.cx, this.cy, PAL.blood, crit ? 12 : 7, crit ? 140 : 100);

    // Barely moved by anything: it is a wall with teeth.
    const dx = this.cx - fromX;
    const dy = this.cy - fromY;
    const len = Math.hypot(dx, dy) || 1;
    if (this.state !== 'act') {
      this.body.setVelocity((dx / len) * (knockback / 8), (dy / len) * (knockback / 8));
    }

    bus.emit('enemy:hit', { id: this.id, type: 'maw', damage: amount, crit, kill: this.hp <= 0 });
    bus.emit('juice:hitstop', { ms: crit ? BAL.combat.hitstopCritMs : BAL.combat.hitstopMs });
    bus.emit('juice:shake', { intensity: BAL.combat.shake.hit, ms: BAL.combat.shakeMs.hit });

    if (!this.phase2 && this.hp <= this.maxHp * 0.5) this.enterPhase2();
    if (this.hp <= 0) this.die();
    return amount;
  }

  private enterPhase2(): void {
    this.phase2 = true;
    this.sprite.play(`${mawSprite.key}_roar`, true);
    this.juice.ring(this.cx, this.cy, PAL.blood, 90, 600);
    bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 400 });
    bus.emit('juice:flash', { color: 0xff2b55, ms: 160 });
    bus.emit('audio:play', { cue: 'mawPhase2' });
    bus.emit('juice:toast', { text: 'It stops pretending to be an animal.', color: '#ff2b55' });
    this.state = 'recover';
    this.stateUntil = this.now + 900;
    this.nextActionAt = this.stateUntil;
  }

  applyStun(seconds: number): void {
    if (seconds <= 0 || this.state === 'act') return;
    this.enter('stunned');
    this.stateUntil = this.now + seconds * 1000;
  }

  applySlow(): void {
    /* The Maw does not slow. */
  }

  private die(): void {
    this.state = 'dead';
    this.hitbox = null;
    this.clearTelegraph();
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    state.bosses.mawDefeated = true;

    bus.emit('boss:defeated', { id: 'maw' });
    bus.emit('juice:flash', { color: 0xffffff, ms: 260 });
    bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 600 });
    bus.emit('audio:play', { cue: 'mawDeath' });

    this.juice.sparks(this.cx, this.cy, PAL.white, 40, 220);
    this.scene.tweens.add({
      targets: [this.sprite, this.shadow],
      alpha: 0,
      scaleY: this.sprite.scaleY * 0.5,
      duration: 1400,
      ease: 'Quad.easeIn',
    });
  }

  private sync(): void {
    if (Math.abs(this.body.velocity.x) > 6) this.sprite.setFlipX(this.body.velocity.x < 0);
    this.sprite.setDepth(this.sprite.y);
    this.shadow.setPosition(this.cx, this.sprite.y - 2).setDepth(this.sprite.y - 2);
  }

  destroy(): void {
    this.clearTelegraph();
    for (const m of this.markers) m.destroy();
    this.markers = [];
    this.shadow.destroy();
    this.sprite.destroy();
  }
}
