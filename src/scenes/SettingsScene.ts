import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { Button } from '../ui/Button';
import { SaveFile } from '../core/SaveFile';
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
  private confirmingRestore = false;
  private status?: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Settings');
  }

  init(data: { returnTo?: string; confirming?: boolean }): void {
    this.returnTo = data?.returnTo ?? 'Title';
    this.confirmingRestore = !!data?.confirming;
    this.values = [];
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
    let y = 42;
    this.rows.forEach((row, i) => {
      const label = this.add.bitmapText(40, y, FONT, row.label).setTint(hex(PAL.white));
      this.add.bitmapText(40, y + 9, FONT, row.hint).setTint(hex(PAL.greyDark));
      const value = this.add
        .bitmapText(width - 44, y, FONT, row.get())
        .setOrigin(1, 0)
        .setTint(hex(PAL.cyan));
      this.values.push(value);

      const hit = this.add
        .rectangle(38, y - 2, width - 80, 17, hex(PAL.deep))
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
      y += 18;
    });

    this.buildSaveFileSection(y + 2);

    new Button(
      this,
      width - 96,
      height - 30,
      { width: 56, height: 16, text: 'BACK', fill: PAL.rust, border: PAL.gold, textColor: PAL.cream },
      () => this.leave(),
    );
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
  }

  /**
   * Your camp as a file. Browser storage can be cleared without warning and does not
   * follow you to another machine, so this is the only way a camp is really yours.
   */
  private buildSaveFileSection(y: number): void {
    const { width } = BAL.view;

    this.add
      .rectangle(40, y, width - 80, 1, hex(PAL.blueDark))
      .setOrigin(0);
    this.add.bitmapText(40, y + 6, FONT, 'YOUR CAMP').setTint(hex(PAL.gold));
    this.add
      .bitmapText(40, y + 16, FONT, 'Keep a copy, or move it to another computer.')
      .setTint(hex(PAL.greyDark));

    this.status = this.add
      .bitmapText(40, y + 42, FONT, '')
      .setTint(hex(PAL.green));

    new Button(
      this,
      40,
      y + 28,
      {
        width: 108,
        height: 16,
        text: 'DOWNLOAD CAMP',
        fill: PAL.deep,
        border: PAL.cyan,
        textColor: PAL.cyan,
      },
      () => {
        SaveSystem.save();
        const name = SaveFile.download();
        this.say(`Saved as ${name}`, PAL.green);
      },
    );

    new Button(
      this,
      156,
      y + 28,
      {
        width: 116,
        height: 16,
        text: this.confirmingRestore ? 'REPLACE? TAP AGAIN' : 'RESTORE FROM FILE',
        fill: this.confirmingRestore ? PAL.rust : PAL.deep,
        border: this.confirmingRestore ? PAL.gold : PAL.violet,
        textColor: this.confirmingRestore ? PAL.cream : PAL.violet,
      },
      () => this.restore(),
    );
  }

  /** Restoring replaces everything, so it takes two presses. */
  private restore(): void {
    if (!this.confirmingRestore) {
      this.confirmingRestore = true;
      this.say('This replaces your camp. Press again.', PAL.gold);
      this.time.delayedCall(4000, () => {
        if (!this.scene.isActive()) return;
        this.confirmingRestore = false;
        this.scene.restart({ returnTo: this.returnTo });
      });
      this.scene.restart({ returnTo: this.returnTo, confirming: true });
      return;
    }

    this.confirmingRestore = false;
    SaveFile.pickAndRestore((result) => {
      if (!this.scene.isActive()) return;
      this.say(result.message, result.ok ? PAL.green : PAL.blood);
      if (result.ok) {
        bus.emit('settings:changed', { key: 'import' });
        // Start again from the restored camp rather than whatever was on screen.
        this.time.delayedCall(900, () => this.scene.start('Camp'));
      } else {
        this.scene.restart({ returnTo: this.returnTo });
      }
    });
  }

  private say(message: string, color: string): void {
    this.status?.setText(message).setTint(hex(color));
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
