import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { PixelFactory, bob } from '../art/PixelFactory';
import type { PixelSprite } from '../art/PixelFactory';
import { FX } from '../art/sprites/fx';
import { hex, PAL } from '../art/palette';
import { MIRA } from '../data/story';

/** Mira: dark coat, teal scarf, so she never reads as the player or as an enemy. */
const P: Record<string, string | null> = {
  '.': null,
  o: '#0a1030',
  c: '#2d5f8a',
  d: '#1b3d5c',
  t: 'teal',
  s: 'skin',
  h: '#6b4a2a',
  b: 'woodDark',
  e: 'cyan',
};

const MIRA_BODY = [
  '................',
  '....oooooooo....',
  '...ohhhhhhhho...',
  '..ohhhhhhhhhho..',
  '..ohsssssssho...',
  '..ohseessesho...',
  '..ohsssssssho...',
  '..ohhsssssho....',
  '...otttttto.....',
  '....tttttttt....',
  '...occcccccco...',
  '..occcccccccco..',
  '..ocdcccccdco...',
  '..occcccccccco..',
  '..occcccccccco..',
  '...occcccccco...',
  '...oddddddddo...',
];

const LEGS = ['....obb..bbo....', '....obb..bbo....', '....obb..bbo....', '.....oo..oo.....'];

const standing = [...MIRA_BODY.slice(0, MIRA_BODY.length), ...LEGS];

export const miraSprite: PixelSprite = {
  key: 'npc-mira',
  fps: 2,
  palette: P,
  anims: {
    idle: [standing, bob(standing, 1)],
    /** Bound and slumped, before the player cuts her loose. */
    bound: [
      [
        '................',
        '................',
        '................',
        '................',
        '....oooooooo....',
        '...ohhhhhhhho...',
        '..ohhhhhhhhhho..',
        '..ohsssssssho...',
        '..ohsooossoho...',
        '..ohsssssssho...',
        '...otttttto.....',
        '...occcccccco...',
        '..occcccccccco..',
        '..oeeeeeeeeeeo..',
        '..occcccccccco..',
        '..oeeeeeeeeeeo..',
        '...occcccccco...',
        '...oddddddddo...',
        '....obb..bbo....',
        '....obb..bbo....',
        '.....oo..oo.....',
      ],
    ],
  },
  fpsOverride: { idle: 2 },
};

export function buildMiraArt(scene: Phaser.Scene): void {
  PixelFactory.build(scene, miraSprite);
}

/**
 * The one survivor. She is found bound in the cabin once the Alpha Beast is dealt with,
 * and after that she is simply at camp, which is the point: the camp stops being empty.
 */
export class NPCMira {
  readonly sprite: Phaser.GameObjects.Sprite;
  private glow?: Phaser.GameObjects.Image;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    private mode: 'field' | 'camp',
  ) {
    scene.add
      .ellipse(x, y - 1, 16, 6, hex(PAL.blue))
      .setAlpha(0.3)
      .setDepth(y - 2);

    this.sprite = scene.add
      .sprite(x, y, miraSprite.key)
      .setOrigin(0.5, 1)
      .setDepth(y)
      .play(`${miraSprite.key}_${mode === 'field' ? 'bound' : 'idle'}`);

    if (mode === 'field') {
      this.glow = scene.add
        .image(x, y - 12, FX.glowMed)
        .setTint(hex(PAL.teal))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.35)
        .setDepth(y - 1);
      scene.tweens.add({
        targets: this.glow,
        alpha: 0.7,
        duration: 1200,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  get cx(): number {
    return this.sprite.x;
  }

  get cy(): number {
    return this.sprite.y - 12;
  }

  inRange(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.cx, this.cy) < 28;
  }

  get prompt(): string {
    if (this.mode === 'field') return state.story.miraRescued ? '' : 'E  CUT HER LOOSE';
    return 'E  TALK TO MIRA';
  }

  /** Returns the lines to show. */
  interact(): string[] {
    if (this.mode === 'field') {
      if (state.story.miraRescued) return [];
      state.story.miraRescued = true;
      bus.emit('npc:rescued', { id: 'mira' });
      bus.emit('audio:play', { cue: 'rescue' });
      this.sprite.play(`${miraSprite.key}_idle`);
      this.scene.tweens.killTweensOf(this.glow!);
      this.glow?.destroy();
      this.glow = undefined;
      return MIRA.rescue;
    }

    const lines: string[] = [];
    lines.push(MIRA.greeting[Math.min(MIRA.greeting.length - 1, state.camp.level - 1)]);
    if (state.bosses.mawDefeated) lines.push(...MIRA.afterBoss);
    if (state.camp.upgrades.signaltable) lines.push(MIRA.signal);
    if (state.story.miraAssignment) {
      lines.push(MIRA.assignments[state.story.miraAssignment]);
    }
    return lines;
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    if (this.glow) this.scene.tweens.killTweensOf(this.glow);
    this.glow?.destroy();
    this.sprite.destroy();
  }
}
