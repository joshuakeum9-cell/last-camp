import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { FONT, wrap } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { Button } from '../ui/Button';
import { SaveSystem } from '../core/SaveSystem';
import { state } from '../core/GameState';

/**
 * Hidden developer screen. Opened with the backtick key or the version label on the
 * title. Phase 7 adds the analytics export; for now it shows the live save.
 */
export class DevScene extends Phaser.Scene {
  constructor() {
    super('Dev');
  }

  create(): void {
    const { width, height } = BAL.view;
    this.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0).setAlpha(0.94);

    this.add
      .bitmapText(8, 8, FONT, 'DEVELOPER')
      .setTint(hex(PAL.green))
      .setScale(1.5);

    const summary = [
      `day ${state.day}`,
      `camp level ${state.camp.level}`,
      `upgrades ${Object.keys(state.camp.upgrades).length}`,
      `areas ${state.map.discoveredAreas.join(', ')}`,
      `deaths ${state.stats.deaths}`,
      `save ${SaveSystem.available ? 'available' : 'blocked'}`,
    ].join('\n');

    this.add
      .bitmapText(8, 30, FONT, wrap(summary, 74))
      .setTint(hex(PAL.cyan))
      .setMaxWidth(width - 16);

    new Button(
      this,
      8,
      height - 26,
      { width: 84, height: 16, text: 'COPY SAVE JSON' },
      () => {
        const json = SaveSystem.exportJson();
        navigator.clipboard?.writeText(json).catch(() => console.log(json));
        console.log(json);
      },
    );

    new Button(
      this,
      98,
      height - 26,
      { width: 70, height: 16, text: 'CLOSE', fill: PAL.rust, border: PAL.gold },
      () => this.scene.stop('Dev'),
    );
  }
}
