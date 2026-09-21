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
import { DIFFICULTY_LIST, activeDifficulty } from '../data/difficulty';

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
      .bitmapText(Math.round(width / 2), 30, FONT, title)
      .setOrigin(0.5, 0)
      .setScale(4)
      .setTint(hex(PAL.white))
      .setDepth(600);
    this.add
      .bitmapText(Math.round(width / 2) + 2, 32, FONT, title)
      .setOrigin(0.5, 0)
      .setScale(4)
      .setTint(hex(PAL.blue))
      .setDepth(599)
      .setAlpha(0.6);
    this.tweens.add({
      targets: t,
      y: 28,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .bitmapText(Math.round(width / 2), 74, FONT, 'the winter did not stop')
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.ice))
      .setDepth(600);

    // --- buttons ---------------------------------------------------------
    const hasSave = SaveSystem.hasSave();
    const bw = 104;
    const bx = Math.round(width / 2 - bw / 2);
    let by = 92;

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

    new Button(
      this,
      bx,
      by + 26,
      { width: bw, height: 20, text: 'SETTINGS', fill: PAL.deep, border: PAL.uiDim, textColor: PAL.uiDim },
      () => {
        this.weather.destroy();
        this.scene.start('Settings', { returnTo: 'Title' });
      },
    ).setDepth(600);

    this.buildDifficultyRow(by + 72);

    const hint = 'WASD move   J or click attack   SPACE dash   E interact';
    this.add
      .bitmapText(Math.round(width / 2), height - 16, FONT, hint)
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.grey))
      .setDepth(600);

    this.add
      .bitmapText(4, height - 11, FONT, 'v0.1')
      .setTint(hex(PAL.uiMuted))
      .setDepth(600)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('Dev'));

    void textWidth;

    this.input.keyboard?.once('keydown-ENTER', () => this.start());
  }

  /**
   * Difficulty sits on the title rather than only in settings, because it is a choice
   * about how the game should feel and the player should make it before the first day
   * rather than discover it after a bad one. It can still be changed at any time.
   */
  private buildDifficultyRow(y: number): void {
    const { width } = BAL.view;

    this.add
      .bitmapText(Math.round(width / 2), y - 11, FONT, 'HOW HARD IS THE WINTER?')
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.uiDim))
      .setDepth(600);

    const bw = 78;
    const gap = 5;
    const total = DIFFICULTY_LIST.length * bw + (DIFFICULTY_LIST.length - 1) * gap;
    let x = Math.round(width / 2 - total / 2);

    for (const def of DIFFICULTY_LIST) {
      const chosen = state.settings.difficulty === def.id;
      new Button(
        this,
        x,
        y,
        {
          width: bw,
          height: 15,
          text: def.name.toUpperCase(),
          fill: chosen ? PAL.blueDark : PAL.deep,
          fillHover: PAL.blueDark,
          border: chosen ? PAL.cyan : PAL.greyDark,
          textColor: chosen ? PAL.white : PAL.uiDim,
        },
        () => {
          state.settings.difficulty = def.id;
          SaveSystem.save();
          this.weather.destroy();
          this.scene.restart();
        },
      ).setDepth(600);
      x += bw + gap;
    }

    this.add
      .bitmapText(Math.round(width / 2), y + 18, FONT, activeDifficulty(state.settings.difficulty).desc)
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.uiMuted))
      .setDepth(600);
  }

  private start(): void {
    this.weather.destroy();
    this.scene.start('Camp');
  }

  update(_time: number, delta: number): void {
    this.weather.update(delta, 0.25);
  }
}
