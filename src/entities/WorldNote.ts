import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { PixelFactory } from '../art/PixelFactory';
import { FX } from '../art/sprites/fx';
import { hex, PAL } from '../art/palette';
import type { NoteDef } from '../data/story';

const NOTE_KEY = 'world-note';

const NOTE_ART = [
  '.wwwwwwwww..',
  'wwkkkkkkkww.',
  'wkwwwwwwwkw.',
  'wkwkkkkwwkw.',
  'wkwwwwwwwkw.',
  'wkwkkkkkwkw.',
  'wkwwwwwwwkw.',
  'wkwkkkwwwkw.',
  'wkwwwwwwwkw.',
  'wwkkkkkkkww.',
  '.wwwwwwwww..',
];

export function buildNoteArt(scene: Phaser.Scene): void {
  PixelFactory.makeTexture(scene, NOTE_KEY, NOTE_ART, {
    '.': null,
    w: 'cream',
    k: 'greyDark',
  });
}

/**
 * A piece of paper in the snow. It is the whole of the story delivery: no quest
 * markers, no dialogue trees, just something somebody wrote down before they stopped.
 */
export class WorldNote {
  readonly sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private taken: boolean;

  constructor(
    private scene: Phaser.Scene,
    readonly def: NoteDef,
    x: number,
    y: number,
  ) {
    this.taken = state.story.notesFound.includes(def.id);

    this.glow = scene.add
      .image(x, y - 4, FX.glowSmall)
      .setTint(hex(PAL.cream))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(this.taken ? 0 : 0.6)
      .setDepth(y - 1);

    this.sprite = scene.add
      .image(x, y, NOTE_KEY)
      .setOrigin(0.5, 1)
      .setScale(1.2)
      .setDepth(y)
      .setVisible(!this.taken);

    if (!this.taken) {
      scene.tweens.add({
        targets: this.sprite,
        y: y - 3,
        duration: 1300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      scene.tweens.add({
        targets: this.glow,
        alpha: 0.95,
        duration: 1000,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  get cx(): number {
    return this.sprite.x;
  }

  get cy(): number {
    return this.sprite.y - 6;
  }

  get isTaken(): boolean {
    return this.taken;
  }

  inRange(px: number, py: number): boolean {
    return !this.taken && Phaser.Math.Distance.Between(px, py, this.cx, this.cy) < 24;
  }

  take(): NoteDef {
    this.taken = true;
    if (!state.story.notesFound.includes(this.def.id)) {
      state.story.notesFound.push(this.def.id);
      state.run?.notesFound.push(this.def.id);
    }
    bus.emit('audio:play', { cue: 'note' });
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.glow);
    this.scene.tweens.add({
      targets: [this.sprite, this.glow],
      alpha: 0,
      y: this.sprite.y - 14,
      duration: 400,
      onComplete: () => {
        this.sprite.setVisible(false);
        this.glow.setVisible(false);
      },
    });
    return this.def;
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.glow);
    this.sprite.destroy();
    this.glow.destroy();
  }
}
