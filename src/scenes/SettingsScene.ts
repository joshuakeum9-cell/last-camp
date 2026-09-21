import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { Button } from '../ui/Button';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';

interface Row {
  label: string;
  hint: string;
  get: () => string;
  cycle: () => void;
}

/**
 * Settings. The accessibility options are not an afterthought: every indicator in the
 * game has a shape or a motion as well as a colour, and each of these switches off one
 * kind of intensity without taking information away.
 */
export class SettingsScene extends Phaser.Scene {
  private rows: Row[] = [];
  private values: Phaser.GameObjects.BitmapText[] = [];
  private returnTo = 'Title';

  constructor() {
    super('Settings');
  }

  init(data: { returnTo?: string }): void {
    this.returnTo = data?.returnTo ?? 'Title';
  }

  create(): void {
    const { width, height } = BAL.view;
    this.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0).setAlpha(0.92);
    this.add
      .rectangle(30, 14, width - 60, height - 28, hex(PAL.navy))
      .setOrigin(0)
      .setStrokeStyle(1, hex(PAL.blueDark));

    this.add.bitmapText(40, 22, FONT, 'SETTINGS').setScale(1.5).setTint(hex(PAL.gold));

    this.rows = this.buildRows();
    let y = 44;
    this.rows.forEach((row, i) => {
      const label = this.add.bitmapText(40, y, FONT, row.label).setTint(hex(PAL.white));
      this.add.bitmapText(40, y + 9, FONT, row.hint).setTint(hex(PAL.greyDark));
      const value = this.add
        .bitmapText(width - 44, y, FONT, row.get())
        .setOrigin(1, 0)
        .setTint(hex(PAL.cyan));
      this.values.push(value);

      const hit = this.add
        .rectangle(38, y - 2, width - 80, 20, hex(PAL.deep))
        .setOrigin(0)
        .setAlpha(0.001)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => hit.setAlpha(0.3));
      hit.on('pointerout', () => hit.setAlpha(0.001));
      hit.on('pointerup', () => {
        row.cycle();
        bus.emit('settings:changed', { key: row.label });
        this.refresh();
      });

      void label;
      void i;
      y += 21;
    });

    new Button(
      this,
      Math.round(width / 2 - 30),
      height - 26,
      { width: 60, height: 16, text: 'BACK', fill: PAL.rust, border: PAL.gold, textColor: PAL.cream },
      () => this.leave(),
    );
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
  }

  private buildRows(): Row[] {
    const s = state.settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const step = (v: number) => (v >= 1 ? 0 : Math.round((v + 0.25) * 100) / 100);

    return [
      {
        label: 'Music',
        hint: 'The wind bed and the boss loop.',
        get: () => pct(s.music),
        cycle: () => {
          s.music = step(s.music);
        },
      },
      {
        label: 'Sound',
        hint: 'Hits, pickups, everything else.',
        get: () => pct(s.sfx),
        cycle: () => {
          s.sfx = step(s.sfx);
        },
      },
      {
        label: 'Screen shake',
        hint: 'Also scales the freeze on a hit.',
        get: () => pct(s.shake),
        cycle: () => {
          s.shake = step(s.shake);
        },
      },
      {
        label: 'Reduce flashing',
        hint: 'Replaces white flashes with a coloured outline. No information is lost.',
        get: () => (s.flashReduction ? 'on' : 'off'),
        cycle: () => {
          s.flashReduction = !s.flashReduction;
        },
      },
      {
        label: 'Longer telegraphs',
        hint: 'Enemies hold their tell 30% longer. Readability, not difficulty.',
        get: () => (s.longTelegraphs ? 'on' : 'off'),
        cycle: () => {
          s.longTelegraphs = !s.longTelegraphs;
        },
      },
      {
        label: 'Large text',
        hint: 'Scales the interface up.',
        get: () => (s.largeText ? 'on' : 'off'),
        cycle: () => {
          s.largeText = !s.largeText;
        },
      },
      {
        label: 'Touch controls',
        hint: 'Auto shows them on a touch screen.',
        get: () => s.showTouch,
        cycle: () => {
          s.showTouch = s.showTouch === 'auto' ? 'on' : s.showTouch === 'on' ? 'off' : 'auto';
        },
      },
      {
        label: 'Touch opacity',
        hint: 'How visible the on-screen controls are.',
        get: () => pct(s.touchOpacity),
        cycle: () => {
          s.touchOpacity = s.touchOpacity >= 0.9 ? 0.25 : Math.round((s.touchOpacity + 0.15) * 100) / 100;
        },
      },
    ];
  }

  private refresh(): void {
    this.rows.forEach((row, i) => this.values[i]?.setText(row.get()));
    SaveSystem.save();
  }

  private leave(): void {
    SaveSystem.save();
    bus.emit('settings:changed', { key: 'close' });
    this.scene.stop();
    if (!this.scene.isActive(this.returnTo)) this.scene.start(this.returnTo);
    else this.scene.resume(this.returnTo);
  }
}
