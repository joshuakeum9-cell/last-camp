import Phaser from 'phaser';
import { PixelFactory, bob } from '../art/PixelFactory';
import type { PixelSprite } from '../art/PixelFactory';
import { FX } from '../art/sprites/fx';
import { hex, PAL } from '../art/palette';

/** A hooded figure in grey with a pack, and a sled behind her. */
const P: Record<string, string | null> = {
  '.': null,
  o: '#0a1030',
  g: 'grey',
  G: 'greyDark',
  s: 'skin',
  n: 'wood',
  k: 'woodDark',
  y: 'gold',
  w: 'cream',
};

const TRADER = [
  '.......oooooo.......',
  '......oggggggo......',
  '.....ogggggggggo....',
  '.....oggossssggo....',
  '.....ogosossosgo....',
  '.....oggossssggo....',
  '......oggggggo......',
  '.....ogggggggggo....',
  '....oggggggggggGo...',
  '...oggggggggggGGGo..',
  '...oggggggggggGGGo..',
  '..oggggggggggoGGGo..',
  '..ogggggggggoonnno..',
  '..ogggggggggonkkno..',
  '..oggggggggggnkkno..',
  '..ogggggggggonnnno..',
  '...ogggggggggoooo...',
  '...oggggggggggo.....',
  '...ogggggggggo......',
  '....oggooogggo......',
  '....ogo...ogo.......',
  '....oko...oko.......',
  '....ooo...ooo.......',
];

const SLED = [
  '..nnnnnnnnnnnnnnnnnnnnnn..',
  '.nkkkkkkkkkkkkkkkkkkkkkkn.',
  'nkwwwwwwwkkyyykkwwwwwwwkkn',
  'nkwwwwwwwkkyyykkwwwwwwwkkn',
  'nkkkkkkkkkkkkkkkkkkkkkkkkn',
  '.nnnnnnnnnnnnnnnnnnnnnnnn.',
  'oo......................oo',
  'oooooooooooooooooooooooooo',
];

export const traderSprite: PixelSprite = {
  key: 'npc-trader',
  fps: 2,
  palette: P,
  anims: { idle: [TRADER, bob(TRADER, 1)] },
  fpsOverride: { idle: 2 },
};

export function buildTraderArt(scene: Phaser.Scene): void {
  PixelFactory.build(scene, traderSprite);
  PixelFactory.makeTexture(scene, 'npc-trader-sled', SLED, P);
}

/**
 * The trader. Some days she is on the road with a sled, and what is on it is
 * worth the detour. She is not part of the story and does not want to be.
 */
export class Trader {
  readonly sprite: Phaser.GameObjects.Sprite;
  private sled: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  private glow: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
  ) {
    this.shadow = scene.add.ellipse(x + 12, y - 1, 52, 10, hex(PAL.blue)).setAlpha(0.3).setDepth(y - 2);
    this.sled = scene.add.image(x + 26, y, 'npc-trader-sled').setOrigin(0.5, 1).setDepth(y - 1);
    this.sprite = scene.add
      .sprite(x, y, traderSprite.key)
      .setOrigin(0.5, 1)
      .setDepth(y)
      .play(`${traderSprite.key}_idle`);
    // A lantern on the sled, so she is findable after dark too.
    this.glow = scene.add
      .image(x + 26, y - 8, FX.glowMed)
      .setTint(hex(PAL.gold))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.3)
      .setScale(0.6)
      .setDepth(y - 1);
    scene.tweens.add({ targets: this.glow, alpha: 0.5, duration: 1100, yoyo: true, repeat: -1 });
  }

  get cx(): number {
    return this.x + 12;
  }

  get cy(): number {
    return this.y - 10;
  }

  get light(): { x: number; y: number; radius: number } {
    return { x: this.x + 26, y: this.y - 8, radius: 50 };
  }

  inRange(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(px, py, this.cx, this.cy) < 34;
  }

  destroy(): void {
    this.shadow.destroy();
    this.sled.destroy();
    this.glow.destroy();
    this.sprite.destroy();
  }
}
