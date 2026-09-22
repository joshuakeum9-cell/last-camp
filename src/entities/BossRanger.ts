import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { BAL } from '../data/balance';
import { activeDifficulty } from '../data/difficulty';
import { PixelFactory, bob, shift } from '../art/PixelFactory';
import type { PixelSprite } from '../art/PixelFactory';
import { hex, PAL } from '../art/palette';
import { FX } from '../art/sprites/fx';
import { Juice } from '../systems/Juice';
import type { Player } from './Player';
import type { Boss, BossHitbox } from './Boss';

const P: Record<string, string | null> = {
  '.': null,
  o: '#0a1030',
  t: '#161c3a',
  r: '#2b3358',
  W: '#eef7ff',
  c: 'cyan',
  y: 'gold',
  e: 'ember',
  b: 'bark',
};

/** A tall figure in a ranger coat, hood up, a lantern held out in one hand. */
const RANGER = [
  '.......oooooo.......',
  '......orrrrrro......',
  '.....orrrrrrrro.....',
  '.....orroWWorro.....',
  '.....oroWcWcWor.....',
  '.....oroWWWWWor.....',
  '.....orroWWorro.....',
  '....orrrrrrrrrro....',
  '...orrrrrrrrrrrro...',
  '..orrrrrrrrrrrrrro..',
  '..orrtrrrrrrrrtrro..',
  '.orrrtrrrrrrrrtrrro.',
  '.orrrtrrrrrrrrtrrro.',
  '.orrrtrrrrrrrrtrroyo',
  '.orrrtrrrrrrrrtrroyo',
  '.orrrrrrrrrrrrrroyyy',
  '..orrrrrrrrrrrrooyey',
  '..orrrrrrrrrrrrooyey',
  '..orrrrrrrrrrrroyyyy',
  '..orrrrrrrrrrrro.oyo',
  '..orrrrrrrrrrrro....',
  '..orrrrrrrrrrrro....',
  '..orrrrrrrrrrrro....',
  '...orrrrrrrrrrro....',
  '...orrrrrrrrrrro....',
  '...orrrooorrrrro....',
  '...orro...orrro.....',
  '...obbo...obbo......',
  '...oooo...oooo......',
];

const RANGER_RAISED = [
  '.......oooooo....oyo',
  '......orrrrrro..oyyy',
  '.....orrrrrrrro.yyey',
  '.....orroWWorroooyey',
  '.....oroWWcWcWoryyyy',
  '.....oroWWWWWWor.oyo',
  '.....orroWWorror....',
  '....orrrrrrrrrrro...',
  '...orrrrrrrrrrrrro..',
  '..orrrrrrrrrrrrrro..',
  '..orrtrrrrrrrrtrro..',
  '.orrrtrrrrrrrrtrrro.',
  '.orrrtrrrrrrrrtrrro.',
  '.orrrtrrrrrrrrtrrro.',
  '.orrrtrrrrrrrrtrrro.',
  '.orrrrrrrrrrrrrrro..',
  '..orrrrrrrrrrrrro...',
  '..orrrrrrrrrrrrro...',
  '..orrrrrrrrrrrrro...',
  '..orrrrrrrrrrrrro...',
  '..orrrrrrrrrrrrro...',
  '..orrrrrrrrrrrrro...',
  '..orrrrrrrrrrrrro...',
  '...orrrrrrrrrrro....',
  '...orrrrrrrrrrro....',
  '...orrrooorrrrro....',
  '...orro...orrro.....',
  '...obbo...obbo......',
  '...oooo...oooo......',
];

export const rangerSprite: PixelSprite = {
  key: 'boss-ranger',
  fps: 4,
  palette: P,
  anims: {
    idle: [RANGER, bob(RANGER, 1)],
    run: [shift(RANGER, 1), shift(RANGER, -1)],
    roar: [RANGER_RAISED, bob(RANGER_RAISED, 1)],
  },
  fpsOverride: { idle: 2, run: 6, roar: 4 },
};

export function buildRangerArt(scene: Phaser.Scene): void {
  PixelFactory.build(scene, rangerSprite);
}

type RangerState = 'hidden' | 'idle' | 'stalk' | 'telegraph' | 'act' | 'recover' | 'stunned' | 'dead';
type Pattern = 'lantern' | 'blink' | 'call';

/**
 * The One Who Stayed. The ranger who wrote the note on the cabin table, who tied
 * Mira up so the walkers would have something to come back for, and who is still
 * checking on her every night. He only comes out after dark, at the cabin.
 *
 * Three questions: a lantern swing that throws a fan of embers to sidestep, a blink
 * that puts him behind you with a swipe on a short mark, and a call that brings two
 * of the eleven walking out of the trees. At half health the lantern throws wider
 * and the blinks come in pairs.
 */
export class BossRanger implements Boss {
  readonly id = 'ranger';
  readonly name = 'The One Who Stayed';
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly maxHp: number;
  hp: number;
  hitbox: BossHitbox | null = null;
  damage: number;

  private state: RangerState = 'hidden';
  private pattern: Pattern = 'lantern';
  private lastPattern: Pattern | null = null;
  private stateUntil = 0;
  private nextActionAt = 0;
  private phase2 = false;
  private blinksLeft = 0;
  private blinkTo = { x: 0, y: 0 };
  private body: Phaser.Physics.Arcade.Body;
  private shadow: Phaser.GameObjects.Ellipse;
  private lantern: Phaser.GameObjects.Image;
  private telegraph?: Phaser.GameObjects.Graphics;
  private marker?: Phaser.GameObjects.Image;
  private home: { x: number; y: number };

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private player: Player,
    private juice: Juice,
    private summon: (x: number, y: number, count: number) => void,
  ) {
    const diff = activeDifficulty(state.settings.difficulty);
    this.maxHp = Math.round(440 * diff.enemyHp);
    this.hp = this.maxHp;
    this.damage = Math.round(18 * diff.enemyDamage);
    this.home = { x, y };

    this.shadow = scene.add.ellipse(x, y - 2, 30, 10, hex(PAL.blue)).setAlpha(0.35).setDepth(y - 2);
    this.sprite = scene.physics.add.sprite(x, y, rangerSprite.key);
    this.sprite.setOrigin(0.5, 1).setScale(1.6).setDepth(y);

    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(12, 10);
    this.body.setOffset((this.sprite.width - 12) / 2, this.sprite.height - 10);
    this.body.setCollideWorldBounds(true);
    this.body.setMass(5);

    this.lantern = scene.add
      .image(x, y - 20, FX.glowMed)
      .setTint(hex(PAL.gold))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setScale(0.6)
      .setDepth(y + 1);

    this.sprite.play(`${rangerSprite.key}_idle`);
    this.setHidden(true);
  }

  get cx(): number {
    return this.body.center.x;
  }

  get cy(): number {
    return this.body.center.y;
  }

  get alive(): boolean {
    return this.state !== 'dead' && this.state !== 'hidden' && this.hp > 0;
  }

  /** The position of the lantern, for the lighting pass. */
  get light(): { x: number; y: number; radius: number } | null {
    if (this.state === 'hidden' || this.state === 'dead') return null;
    return { x: this.cx, y: this.cy - 10, radius: this.phase2 ? 50 : 90 };
  }

  private get now(): number {
    return this.scene.time.now;
  }

  /** Only here after dark. By day the cabin is just a cabin. */
  setNight(on: boolean): void {
    if (this.state === 'dead') return;
    if (on && this.state === 'hidden') {
      this.setHidden(false);
      this.state = 'idle';
      this.sprite.setAlpha(0);
      this.scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 900 });
      bus.emit('juice:toast', { text: 'A lantern is moving through the cabin.', color: '#ffcf1f' });
    } else if (!on && this.state !== 'hidden') {
      this.clearTelegraph();
      this.hitbox = null;
      this.setHidden(true);
      this.state = 'hidden';
      // Whatever he took, he keeps. Whatever you did to him, he keeps too.
      this.sprite.setPosition(this.home.x, this.home.y);
      this.body.reset(this.home.x, this.home.y);
    }
  }

  private setHidden(hidden: boolean): void {
    this.sprite.setVisible(!hidden);
    this.shadow.setVisible(!hidden);
    this.lantern.setVisible(!hidden);
    this.body.enable = !hidden;
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
        this.body.setVelocity(0, 0);
        if (dist < 220) this.enter('stalk');
        break;

      case 'stalk': {
        // Keeps his distance and drifts sideways, a lantern that will not be caught.
        const speed = this.phase2 ? 78 : 60;
        const side = { x: -dirY, y: dirX };
        const pull = dist > 130 ? 0.6 : dist < 80 ? -0.9 : 0;
        this.body.setVelocity((dirX * pull + side.x * 0.7) * speed, (dirY * pull + side.y * 0.7) * speed);
        this.sprite.play(`${rangerSprite.key}_run`, true);
        if (this.now >= this.nextActionAt) this.choosePattern(dist);
        break;
      }

      case 'telegraph':
        this.body.setVelocity(0, 0);
        if (this.now >= this.stateUntil) this.act(dirX, dirY);
        break;

      case 'act':
        if (this.pattern === 'blink' && this.hitbox) {
          this.hitbox.x = this.cx;
          this.hitbox.y = this.cy;
        }
        if (this.now >= this.stateUntil) this.finishPattern();
        break;

      case 'recover':
        this.body.setVelocity(this.body.velocity.x * 0.85, this.body.velocity.y * 0.85);
        this.sprite.play(`${rangerSprite.key}_idle`, true);
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

  private telegraphTime(): number {
    const base = this.pattern === 'lantern' ? 700 : this.pattern === 'blink' ? 550 : 900;
    const scaled = (this.phase2 ? base * 0.85 : base) * activeDifficulty(state.settings.difficulty).telegraph;
    return state.settings.longTelegraphs ? scaled * 1.3 : scaled;
  }

  private choosePattern(dist: number): void {
    const options: Pattern[] = ['lantern', 'blink', 'call'];
    const allowed = options.filter((p) => p !== this.lastPattern);
    let pick = allowed[Math.floor(Math.random() * allowed.length)];
    if (dist < 60 && allowed.includes('blink')) pick = 'blink';
    if (dist > 170 && allowed.includes('lantern')) pick = 'lantern';
    this.pattern = pick;
    this.lastPattern = pick;
    this.blinksLeft = pick === 'blink' && this.phase2 ? 2 : 1;
    this.enter('telegraph');
  }

  private enter(next: RangerState): void {
    this.state = next;
    switch (next) {
      case 'telegraph':
        this.stateUntil = this.now + this.telegraphTime();
        this.showTelegraph();
        this.sprite.play(`${rangerSprite.key}_roar`, true);
        bus.emit('audio:play', { cue: 'ranger' });
        break;
      case 'act':
        this.stateUntil = this.now + (this.pattern === 'blink' ? 320 : 250);
        this.clearTelegraph();
        break;
      case 'recover':
        this.stateUntil = this.now + (this.pattern === 'call' ? 1100 : 700);
        this.hitbox = null;
        this.nextActionAt = this.stateUntil + (this.phase2 ? 250 : 600);
        break;
      case 'stunned':
        this.stateUntil = this.now + 1000;
        this.hitbox = null;
        this.nextActionAt = this.stateUntil + 300;
        break;
    }
  }

  private act(dirX: number, dirY: number): void {
    this.enter('act');

    if (this.pattern === 'lantern') {
      const count = this.phase2 ? 5 : 3;
      const spread = this.phase2 ? 0.9 : 0.5;
      const base = Math.atan2(dirY, dirX);
      for (let i = 0; i < count; i++) {
        const a = base + (i - (count - 1) / 2) * (spread / Math.max(1, count - 1)) * 2;
        this.throwEmber(Math.cos(a), Math.sin(a));
      }
      bus.emit('audio:play', { cue: 'spit' });
      return;
    }

    if (this.pattern === 'blink') {
      // Gone, then behind you, then the swipe. The mark said where.
      this.juice.sparks(this.cx, this.cy, PAL.gold, 10, 90);
      this.sprite.setPosition(this.blinkTo.x, this.blinkTo.y + 8);
      this.body.reset(this.blinkTo.x, this.blinkTo.y + 8);
      this.juice.ring(this.cx, this.cy, PAL.gold, 24, 220);
      bus.emit('audio:play', { cue: 'mawStun' });
      this.hitbox = {
        x: this.cx,
        y: this.cy,
        radius: 30,
        damage: this.damage,
        until: this.now + 320,
        spent: false,
        bornAt: this.now + 120,
      };
      return;
    }

    // Call: two of the eleven, from the treeline.
    bus.emit('audio:play', { cue: 'mawHowl' });
    bus.emit('juice:toast', { text: 'He calls, and the trees answer.', color: '#a8b8dc' });
    this.summon(this.cx, this.cy, 2);
  }

  private throwEmber(dirX: number, dirY: number): void {
    const scene = this.scene;
    const shot = scene.add
      .image(this.cx, this.cy - 8, FX.dot3)
      .setScale(2)
      .setTint(hex(PAL.gold))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.sprite.y + 2);
    const speed = this.phase2 ? 150 : 125;
    const startX = shot.x;
    const startY = shot.y;
    const damage = Math.round(this.damage * 0.6);
    const player = this.player;

    const tick = () => {
      if (!shot.active || !this.alive) {
        shot.destroy();
        return;
      }
      shot.x += dirX * speed * (1 / 60);
      shot.y += dirY * speed * (1 / 60);
      const d = Phaser.Math.Distance.Between(shot.x, shot.y, player.cx, player.cy);
      if (d < 10) {
        if (!player.isInvulnerable) player.takeDamage(damage, shot.x, shot.y, 'ember');
        this.juice.sparks(shot.x, shot.y, PAL.gold, 6, 80);
        shot.destroy();
        return;
      }
      if (Phaser.Math.Distance.Between(shot.x, shot.y, startX, startY) > 240) {
        shot.destroy();
        return;
      }
      scene.time.delayedCall(16, tick);
    };
    tick();
  }

  private finishPattern(): void {
    if (this.pattern === 'blink' && this.blinksLeft > 1) {
      this.blinksLeft--;
      this.hitbox = null;
      this.enter('telegraph');
      this.stateUntil = this.now + 380;
      this.showTelegraph();
      return;
    }
    this.enter('recover');
  }

  // --- telegraphs --------------------------------------------------------

  private showTelegraph(): void {
    this.clearTelegraph();
    const g = this.scene.add.graphics().setDepth(1);
    this.telegraph = g;
    const color = hex(PAL.gold);

    if (this.pattern === 'lantern') {
      const a = Math.atan2(this.player.cy - this.cy, this.player.cx - this.cx);
      const spread = this.phase2 ? 0.9 : 0.5;
      g.fillStyle(color, 0.14);
      g.lineStyle(2, color, 0.8);
      g.beginPath();
      g.moveTo(this.cx, this.cy);
      g.lineTo(this.cx + Math.cos(a - spread) * 200, this.cy + Math.sin(a - spread) * 200);
      g.lineTo(this.cx + Math.cos(a + spread) * 200, this.cy + Math.sin(a + spread) * 200);
      g.closePath();
      g.fillPath();
      g.strokePath();
    } else if (this.pattern === 'blink') {
      // The mark is where he will be: behind the player, away from where he is now.
      const ax = this.player.cx - this.cx;
      const ay = this.player.cy - this.cy;
      const len = Math.hypot(ax, ay) || 1;
      this.blinkTo = { x: this.player.cx + (ax / len) * 26, y: this.player.cy + (ay / len) * 26 };
      this.marker?.destroy();
      this.marker = this.scene.add
        .image(this.blinkTo.x, this.blinkTo.y, FX.ring)
        .setTint(color)
        .setScale(0.7)
        .setAlpha(0.9)
        .setDepth(1);
      const m = this.marker;
      this.scene.tweens.add({ targets: m, scale: 0.4, duration: this.telegraphTime(), onComplete: () => m.destroy() });
    } else {
      g.lineStyle(2, color, 0.7);
      g.strokeCircle(this.cx, this.cy, 120);
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
    this.juice.sparks(this.cx, this.cy, PAL.gold, crit ? 12 : 7, crit ? 140 : 100);

    const dx = this.cx - fromX;
    const dy = this.cy - fromY;
    const len = Math.hypot(dx, dy) || 1;
    if (this.state !== 'act') this.body.setVelocity((dx / len) * (knockback / 5), (dy / len) * (knockback / 5));

    bus.emit('enemy:hit', { id: this.id, type: 'ranger', damage: amount, crit, kill: this.hp <= 0 });
    bus.emit('juice:hitstop', { ms: crit ? BAL.combat.hitstopCritMs : BAL.combat.hitstopMs });
    bus.emit('juice:shake', { intensity: BAL.combat.shake.hit, ms: BAL.combat.shakeMs.hit });

    if (!this.phase2 && this.hp <= this.maxHp * 0.5) this.enterPhase2();
    if (this.hp <= 0) this.die();
    return amount;
  }

  private enterPhase2(): void {
    this.phase2 = true;
    this.lantern.setTint(hex(PAL.ember)).setScale(0.4);
    this.juice.ring(this.cx, this.cy, PAL.ember, 80, 600);
    bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 300 });
    bus.emit('audio:play', { cue: 'mawPhase2' });
    bus.emit('juice:toast', { text: 'The lantern burns down to an ember.', color: '#ff8a00' });
    this.state = 'recover';
    this.stateUntil = this.now + 800;
    this.nextActionAt = this.stateUntil;
  }

  applyStun(seconds: number): void {
    if (seconds <= 0 || this.state === 'act') return;
    this.enter('stunned');
    this.stateUntil = this.now + seconds * 1000;
  }

  applySlow(): void {
    /* He is already slow. */
  }

  private die(): void {
    this.state = 'dead';
    this.hitbox = null;
    this.clearTelegraph();
    this.marker?.destroy();
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    state.bosses.rangerDefeated = true;

    bus.emit('boss:defeated', { id: 'ranger' });
    bus.emit('juice:flash', { color: 0xffcf1f, ms: 260 });
    bus.emit('juice:shake', { intensity: BAL.combat.shake.boss, ms: 500 });
    bus.emit('audio:play', { cue: 'mawDeath' });

    this.juice.sparks(this.cx, this.cy, PAL.gold, 30, 200);
    this.scene.tweens.add({
      targets: [this.sprite, this.shadow, this.lantern],
      alpha: 0,
      duration: 1600,
      ease: 'Quad.easeIn',
    });
  }

  private sync(): void {
    if (Math.abs(this.body.velocity.x) > 6) this.sprite.setFlipX(this.body.velocity.x < 0);
    this.sprite.setDepth(this.sprite.y);
    this.shadow.setPosition(this.cx, this.sprite.y - 2).setDepth(this.sprite.y - 2);
    const side = this.sprite.flipX ? -12 : 12;
    this.lantern.setPosition(this.cx + side, this.cy - 8).setDepth(this.sprite.y + 1);
  }

  destroy(): void {
    this.clearTelegraph();
    this.marker?.destroy();
    this.shadow.destroy();
    this.lantern.destroy();
    this.sprite.destroy();
  }
}
