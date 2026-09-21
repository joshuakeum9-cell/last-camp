import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { FONT, textWidth } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { Button } from '../ui/Button';
import { Weather } from '../systems/Weather';
import { SaveSystem } from '../core/SaveSystem';
import { state } from '../core/GameState';
import { FX } from '../art/sprites/fx';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import { campfireSprite } from '../art/sprites/camp';

export class TitleScene extends Phaser.Scene {
  private weather!: Weather;

  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = BAL.view;
    this.cameras.main.setBackgroundColor(PAL.navy);

    // A cold horizon with the signal tower on it, so the goal is visible from minute zero.
    this.add.rectangle(0, 0, width, height, hex(PAL.navy)).setOrigin(0);
    this.add.rectangle(0, height - 96, width, 96, hex(PAL.deep)).setOrigin(0);
    this.add.rectangle(0, height - 64, width, 64, hex('#101a48')).setOrigin(0);
    this.add.rectangle(0, height - 34, width, 34, hex(PAL.snowShade)).setOrigin(0);
    this.add.rectangle(0, height - 30, width, 30, hex(PAL.snow)).setOrigin(0);

    const tower = this.add
      .image(width - 74, height - 92, SCENERY_KEYS.tower)
      .setOrigin(0.5, 1)
      .setScale(3)
      .setTint(hex(PAL.black))
      .setAlpha(0.85);
    this.tweens.add({
      targets: tower,
      alpha: 0.7,
      duration: 2600,
      yoyo: true,
      repeat: -1,
    });

    for (let i = 0; i < 7; i++) {
      this.add
        .image(24 + i * 74 + (i % 2) * 22, height - 84 + (i % 3) * 5, SCENERY_KEYS.pine)
        .setOrigin(0.5, 1)
        .setScale(1.6)
        .setTint(hex(i % 2 ? PAL.navy : PAL.deep));
    }

    // The campfire: the most recognisable thing in the game, burning before the title.
    const fireGlow = this.add
      .image(74, height - 44, FX.glowLarge)
      .setTint(hex(PAL.orange))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55)
      .setScale(1.1);
    this.tweens.add({
      targets: fireGlow,
      alpha: 0.75,
      scale: 1.25,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.add
      .sprite(74, height - 36, campfireSprite.key)
      .setOrigin(0.5, 1)
      .setScale(2)
      .play(`${campfireSprite.key}_burn`);

    this.weather = new Weather(this, 500);

    // --- title -----------------------------------------------------------
    const title = 'LAST CAMP';
    const t = this.add
      .bitmapText(Math.round(width / 2), 44, FONT, title)
      .setOrigin(0.5, 0)
      .setScale(4)
      .setTint(hex(PAL.white))
      .setDepth(600);
    this.add
      .bitmapText(Math.round(width / 2) + 2, 46, FONT, title)
      .setOrigin(0.5, 0)
      .setScale(4)
      .setTint(hex(PAL.blue))
      .setDepth(599)
      .setAlpha(0.6);
    this.tweens.add({
      targets: t,
      y: 42,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .bitmapText(Math.round(width / 2), 88, FONT, 'the winter did not stop')
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.ice))
      .setDepth(600);

    // --- buttons ---------------------------------------------------------
    const hasSave = SaveSystem.hasSave();
    const bw = 104;
    const bx = Math.round(width / 2 - bw / 2);
    let by = 132;

    if (hasSave) {
      new Button(
        this,
        bx,
        by,
        { width: bw, height: 20, text: `CONTINUE  DAY ${state.day}`, fill: PAL.rust, fillHover: PAL.ember, border: PAL.gold, textColor: PAL.cream },
        () => this.start(),
      ).setDepth(600);
      by += 26;
    }

    new Button(
      this,
      bx,
      by,
      { width: bw, height: 20, text: hasSave ? 'NEW CAMP' : 'BEGIN' },
      () => {
        if (hasSave && !confirm('Start over? Your camp and everything in it will be lost.')) return;
        SaveSystem.reset();
        this.start();
      },
    ).setDepth(600);

    const hint = 'WASD move   J or click attack   SPACE dash   E interact';
    this.add
      .bitmapText(Math.round(width / 2), height - 16, FONT, hint)
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.grey))
      .setDepth(600);

    this.add
      .bitmapText(4, height - 11, FONT, 'v0.1')
      .setTint(hex(PAL.greyDark))
      .setDepth(600)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('Dev'));

    void textWidth;

    this.input.keyboard?.once('keydown-ENTER', () => this.start());
  }

  private start(): void {
    this.weather.destroy();
    this.scene.start('Camp');
  }

  update(_time: number, delta: number): void {
    this.weather.update(delta, 0.25);
  }
}
