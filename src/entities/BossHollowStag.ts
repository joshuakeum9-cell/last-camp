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
import type { Boss, BossHitbox } from './Boss';

const P: Record<string, string | null> = {
  '.': null,
  o: '#0a1030',
  W: '#eef7ff',
  w: 'white',
  S: 'greyDark',
  c: 'cyan',
  C: 'ice',
  e: 'blood',
};

const STAG = [
  '......c.......c.........................',
  '.....cC.....cCC.........................',
  '....cCC....cCC..........................',
  '.....CCc..CCc...........................',
  '......CCcCC.............................',
  '.......oCCo.............................',
  '.......oWWWo............................',
  '......oWWWWWo...........................',
  '......oWeWWWWo..........................',
  '......oWWWWWWWoooooooooooooooooooo......',
  '.......oWWWWWWWWWWWWWWWWWWWWWWWWWWo.....',
  '........oWWoWWWWWWWWWWWWWWWWWWWWWWWo....',
  '.........oooWWoWoWoWoWoWoWoWoWoWWWWWo...',
  '............oWoWoWoWoWoWoWoWoWoWWWWWWo..',
  '............oWoWoWoWoWoWoWoWoWoWWWWWWo..',
  '............oWWoWoWoWoWoWoWoWoWWWWWWWo..',
  '.............oWWWWWWWWWWWWWWWWWWWWWWo...',
  '..............oWWWWWWWWWWWWWWWWWWWWo....',
  '...............ooWWWooooooooWWWooo......',
  '.................oWWo......oWWo.........',
  '.................oWWo......oWWo.........',
  '.................oWWo......oWWo.........',
  '................oWWo......oWWo..........',
  '................oWWo......oWWo..........',
  '................oWWo......oWWo..........',
  '...............oWWo......oWWo...........',
  '...............oSSo......oSSo...........',
  '...............oooo......oooo...........',
];

const STAG_RUN = [
  ...STAG.slice(0, 19),
  '.................oWWo......oWWo.........',
  '................oWWo........oWWo........',
  '...............oWWo..........oWWo.......',
  '..............oWWo............oWWo......',
  '.............oWWo..............oWWo.....',
  '............oWWo................oWWo....',
  '...........oWWo..................oWWo...',
  '...........oSSo..................oSSo...',
  '...........oooo..................oooo...',
];

export const stagSprite: PixelSprite = {
  key: 'boss-stag',
  fps: 6,
  palette: P,
  anims: {
    idle: [STAG, bob(STAG, 1)],
    run: [STAG_RUN, STAG],
    roar: [bob(STAG, 2), STAG],
  },
  fpsOverride: { idle: 2, run: 7, roar: 5 },
};

export function buildStagArt(scene: Phaser.Scene): void {
  PixelFactory.build(scene, stagSprite);
}

type StagState = 'idle' | 'stalk' | 'telegraph' | 'act' | 'recover' | 'stunned' | 'dead';
type Pattern = 'charge' | 'stomp' | 'icefall';

/**
 * The Hollow Stag. What is left of an elk, held together by the ice in its bones,
 * pacing the tower pass. Three questions: a long antler charge that ends in a wall
 * or a stun, a stomp that sends a ring out from its hooves which has to be dashed
 * through, and an ice fall that marks the ground round you and punishes standing.
 * At half health everything is faster and the ice fall comes twice.
 */
export class BossHollowStag implements Boss {
  readonly id = 'stag';
  readonly name = 'The Hollow Stag';
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly maxHp: number;
  hp: number;
  hitbox: BossHitbox | null = null;
  damage: number;

  private state: StagState = 'idle';
  private pattern: Pattern = 'charge';
  private lastPattern: Pattern | null = null;
  private stateUntil = 0;
  private nextActionAt = 0;
  private phase2 = false;
  private chargeDir = { x: 1, y: 0 };
  private body: Phaser.Physics.Arcade.Body;
  private shadow: Phaser.GameObjects.Ellipse;
  private telegraph?: Phaser.GameObjects.Graphics;
  private ringFx?: Phaser.GameObjects.Image;
  private markers: Phaser.GameObjects.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private player: Player,
    private juice: Juice,
  ) {
    const diff = activeDifficulty(state.settings.difficulty);
    this.maxHp = Math.round(520 * diff.enemyHp);
    this.hp = this.maxHp;
    this.damage = Math.round(20 * diff.enemyDamage);

    this.shadow = scene.add
      .ellipse(x, y - 2, 64, 20, hex(PAL.blue))
      .setAlpha(0.35)
      .setDepth(y - 2);

    this.sprite = scene.physics.add.sprite(x, y, stagSprite.key);
    this.sprite.setOrigin(0.5, 1).setScale(2).setDepth(y);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(30, 16);
    this.body.setOffset((this.sprite.width - 30) / 2, this.sprite.height - 16);
    this.body.setCollideWorldBounds(true);
    this.body.setMass(8);

    this.sprite.play(`${stagSprite.key}_idle`);
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
    const dx = this.player.cx - this.cx;
    const dy = this.player.cy - this.cy;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;

    switch (this.state) {
      case 'idle':
        if (dist < 240) this.enter('stalk');
        break;

      case 'stalk': {
        // Paces in a wide arc, keeping its antlers toward you.
        const speed = this.phase2 ? 92 : 70;
        const side = { x: -dirY, y: dirX };
        const pull = dist > 120 ? 0.7 : dist < 70 ? -0.5 : 0.1;
        this.body.setVelocity((dirX * pull + side.x * 0.6) * speed, (dirY * pull + side.y * 0.6) * speed);
        this.sprite.play(`${stagSprite.key}_run`, true);
        if (this.now >= this.nextActionAt) this.choosePattern(dist, dirX, dirY);
        break;
      }

      case 'telegraph':
        this.body.setVelocity(0, 0);
        if (this.pattern === 'charge' && this.telegraphProgress() > 0.75) {
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
        this.sprite.play(`${stagSprite.key}_idle`, true);
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
    const base = this.pattern === 'charge' ? 900 : this.pattern === 'stomp' ? 800 : 700;
    const scaled = (this.phase2 ? base * 0.8 : base) * activeDifficulty(state.settings.difficulty).telegraph;
    return state.settings.longTelegraphs ? scaled * 1.3 : scaled;
  }

  private choosePattern(dist: number, dirX: number, dirY: number): void {
    const options: Pattern[] = ['charge', 'stomp', 'icefall'];
    const allowed = options.filter((p) => p !== this.lastPattern);
    let pick = allowed[Math.floor(Math.random() * allowed.length)];
    if (dist > 160 && allowed.includes('charge')) pick = 'charge';
    if (dist < 60 && allowed.includes('stomp')) pick = 'stomp';

    this.pattern = pick;
    this.lastPattern = pick;
    this.chargeDir = { x: dirX, y: dirY };
    this.enter('telegraph');
  }

  private enter(next: StagState): void {
    this.state = next;
    switch (next) {
      case 'telegraph':
        this.stateUntil = this.now + this.telegraphTime();
        this.showTelegraph();
        this.sprite.play(`${stagSprite.key}_roar`, true);
        bus.emit('audio:play', { cue: 'stag' });
        break;
      case 'act':
        this.stateUntil = this.now + (this.pattern === 'charge' ? 1000 : this.pattern === 'stomp' ? 520 : 300);
        this.clearTelegraph();
        this.sprite.play(`${stagSprite.key}_run`, true);
        break;
      case 'recover':
        this.stateUntil = this.now + (this.pattern === 'charge' ? 1100 : 700);
        this.hitbox = null;
        this.nextActionAt = this.stateUntil + (this.phase2 ? 250 : 550);
        break;
      case 'stunned':
        this.stateUntil = this.now + 1500;
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
      this.hitbox = { x: this.cx, y: this.cy, radius: 26, damage: this.damage, until: now + 1000, spent: false, bornAt: now };
      return;
    }

    if (this.pattern === 'stomp') {
      // A ring that grows from the hooves. Only the band hurts; dash through it.
      this.hitbox = {
        x: this.cx,
        y: this.cy,
        radius: 12,
        innerRadius: 0,
        damage: this.damage,
        until: now + 520,
        spent: false,
        bornAt: now,
      };
      this.ringFx?.destroy();
      this.ringFx = this.scene.add
        .image(this.cx, this.cy, FX.ring)
        .setTint(hex(PAL.ice))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.3)
        .setDepth(this.sprite.y - 1);
      bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 260 });
      bus.emit('audio:play', { cue: 'mawSlam' });
      return;
    }

    // Ice fall: the markers were drawn round the player; icicles land on them.
    bus.emit('audio:play', { cue: 'mawHowl' });
    const drop = (delay: number) => {
      for (const marker of this.markers) {
        const x = marker.x;
        const y = marker.y;
        this.scene.time.delayedCall(delay, () => {
          const icicle = this.scene.add
            .image(x, y - 90, WFX.icicle)
            .setScale(2)
            .setTint(hex(PAL.ice))
            .setDepth(y + 2);
          this.scene.tweens.add({
            targets: icicle,
            y,
            duration: 200,
            ease: 'Quad.easeIn',
            onComplete: () => {
              this.juice.sparks(x, y, PAL.cyan, 8, 110);
              bus.emit('juice:shake', { intensity: 2, ms: 90 });
              if (Phaser.Math.Distance.Between(this.player.cx, this.player.cy, x, y) < 20) {
                this.player.takeDamage(Math.round(this.damage * 0.7), x, y, 'icicle');
              }
              icicle.destroy();
            },
          });
        });
      }
    };
    drop(900);
    if (this.phase2) drop(1700);
  }

  private runPattern(): void {
    if (!this.hitbox) return;
    if (this.pattern === 'charge') {
      const speed = this.phase2 ? 360 : 310;
      this.body.setVelocity(this.chargeDir.x * speed, this.chargeDir.y * speed);
      this.hitbox.x = this.cx;
      this.hitbox.y = this.cy;
      if (this.body.blocked.left || this.body.blocked.right || this.body.blocked.up || this.body.blocked.down) {
        this.stateUntil = this.now;
        this.wallSlam();
      }
      return;
    }
    if (this.pattern === 'stomp') {
      this.body.setVelocity(0, 0);
      const t = Phaser.Math.Clamp(1 - (this.stateUntil - this.now) / 520, 0, 1);
      const radius = 12 + 80 * t;
      this.hitbox.radius = radius;
      this.hitbox.innerRadius = Math.max(0, radius - 18);
      this.ringFx?.setScale((radius * 2) / 32).setAlpha(1 - t * 0.6);
    }
  }

  private wallSlam(): void {
    this.hitbox = null;
    this.juice.sparks(this.cx, this.cy, PAL.cyan, 18, 180);
    this.juice.ring(this.cx, this.cy, PAL.white, 56, 420);
    bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 300 });
    bus.emit('audio:play', { cue: 'mawStun' });
    bus.emit('juice:toast', { text: 'Its antlers are stuck. Now.', color: '#7bf3ff' });
    this.enter('stunned');
  }

  private finishPattern(): void {
    this.ringFx?.destroy();
    this.ringFx = undefined;
    this.enter('recover');
  }

  // --- telegraphs --------------------------------------------------------

  private showTelegraph(): void {
    this.clearTelegraph();
    const g = this.scene.add.graphics().setDepth(1);
    this.telegraph = g;
    const color = hex(PAL.ice);

    if (this.pattern === 'charge') {
      const a = Math.atan2(this.chargeDir.y, this.chargeDir.x);
      const w = 44;
      const len = 260;
      g.fillStyle(color, 0.16);
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
    } else if (this.pattern === 'stomp') {
      g.lineStyle(3, color, 0.9);
      g.strokeCircle(this.cx, this.cy, 92);
      g.lineStyle(1, color, 0.5);
      g.strokeCircle(this.cx, this.cy, 40);
    } else {
      for (const m of this.markers) m.destroy();
      this.markers = [];
      const count = this.phase2 ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
        const r = 28 + Math.random() * 60;
        const x = this.player.cx + Math.cos(angle) * r;
        const y = this.player.cy + Math.sin(angle) * r;
        const marker = this.scene.add
          .image(x, y, FX.ring)
          .setTint(color)
          .setScale(0.5)
          .setAlpha(0.85)
          .setDepth(1);
        this.markers.push(marker);
        this.scene.time.delayedCall(this.phase2 ? 2600 : 1900, () => marker.destroy());
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
    // Stunned against a wall it takes half again: the window is the reward.
    const dealt = this.state === 'stunned' ? Math.round(amount * 1.5) : amount;
    this.hp -= dealt;

    Juice.flashSprite(this.scene, this.sprite);
    this.juice.floatNumber(this.cx, this.sprite.y - this.sprite.displayHeight * 0.8, dealt, crit || this.state === 'stunned' ? 'crit' : 'normal');
    this.juice.sparks(this.cx, this.cy, PAL.cyan, crit ? 12 : 7, crit ? 140 : 100);

    const dx = this.cx - fromX;
    const dy = this.cy - fromY;
    const len = Math.hypot(dx, dy) || 1;
    if (this.state !== 'act') this.body.setVelocity((dx / len) * (knockback / 8), (dy / len) * (knockback / 8));

    bus.emit('enemy:hit', { id: this.id, type: 'stag', damage: dealt, crit, kill: this.hp <= 0 });
    bus.emit('juice:hitstop', { ms: crit ? BAL.combat.hitstopCritMs : BAL.combat.hitstopMs });
    bus.emit('juice:shake', { intensity: BAL.combat.shake.hit, ms: BAL.combat.shakeMs.hit });

    if (!this.phase2 && this.hp <= this.maxHp * 0.5) this.enterPhase2();
    if (this.hp <= 0) this.die();
    return dealt;
  }

  private enterPhase2(): void {
    this.phase2 = true;
    this.sprite.play(`${stagSprite.key}_roar`, true);
    this.juice.ring(this.cx, this.cy, PAL.ice, 90, 600);
    bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 400 });
    bus.emit('juice:flash', { color: 0x7bf3ff, ms: 160 });
    bus.emit('audio:play', { cue: 'mawPhase2' });
    bus.emit('juice:toast', { text: 'The ice in its bones starts to sing.', color: '#7bf3ff' });
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
    /* Nothing slows it. It is already mostly ice. */
  }

  private die(): void {
    this.state = 'dead';
    this.hitbox = null;
    this.clearTelegraph();
    this.ringFx?.destroy();
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    state.bosses.stagDefeated = true;

    bus.emit('boss:defeated', { id: 'stag' });
    bus.emit('juice:flash', { color: 0xffffff, ms: 260 });
    bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 600 });
    bus.emit('audio:play', { cue: 'mawDeath' });

    this.juice.sparks(this.cx, this.cy, PAL.cyan, 40, 220);
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
    if (this.ringFx) this.ringFx.setPosition(this.cx, this.cy);
  }

  destroy(): void {
    this.clearTelegraph();
    this.ringFx?.destroy();
    for (const m of this.markers) m.destroy();
    this.markers = [];
    this.shadow.destroy();
    this.sprite.destroy();
  }
}
