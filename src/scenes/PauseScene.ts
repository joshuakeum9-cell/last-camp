import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { SaveSystem } from '../core/SaveSystem';
import { Button } from '../ui/Button';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';

/**
 * The pause menu, over a frozen expedition. Resume, settings, or save and leave
 * for the title. Leaving keeps the run: Continue picks it up out here.
 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    const { width, height } = BAL.view;
    this.scene.pause('World');

    this.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0).setAlpha(0.72);
    this.add
      .bitmapText(Math.round(width / 2), 52, FONT, 'PAUSED')
      .setOrigin(0.5, 0)
      .setScale(2)
      .setTint(hex(PAL.gold));

    const bw = 124;
    const bx = Math.round(width / 2 - bw / 2);
    let by = 80;

    new Button(
      this,
      bx,
      by,
      { width: bw, height: 20, text: 'RESUME', fill: PAL.rust, fillHover: PAL.ember, border: PAL.gold, textColor: PAL.cream },
      () => this.resumeWorld(),
    );
    by += 24;
    new Button(
      this,
      bx,
      by,
      { width: bw, height: 20, text: 'CONTROLS', fill: PAL.deep, border: PAL.cyan, textColor: PAL.white },
      () => {
        this.scene.stop();
        this.scene.launch('Controls', { next: 'World' });
        this.scene.bringToTop('Controls');
      },
    );
    by += 24;
    new Button(
      this,
      bx,
      by,
      { width: bw, height: 20, text: 'SETTINGS', fill: PAL.deep, border: PAL.cyan, textColor: PAL.white },
      () => {
        this.scene.stop();
        this.scene.launch('Settings', { returnTo: 'World' });
        this.scene.bringToTop('Settings');
      },
    );
    by += 24;
    new Button(
      this,
      bx,
      by,
      { width: bw, height: 20, text: 'SAVE AND QUIT', fill: PAL.deep, border: PAL.uiDim, textColor: PAL.uiDim },
      () => {
        SaveSystem.save();
        this.scene.stop('World');
        this.scene.stop('HUD');
        this.scene.stop();
        this.scene.start('Title');
      },
    );

    this.add
      .bitmapText(Math.round(width / 2), by + 30, FONT, 'The day is saved. Continue picks it up right here.')
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.uiMuted));

    this.input.keyboard?.once('keydown-ESC', () => this.resumeWorld());
  }

  private resumeWorld(): void {
    this.scene.stop();
    this.scene.resume('World');
  }
}
