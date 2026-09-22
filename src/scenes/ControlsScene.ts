import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { Button } from '../ui/Button';
import { FONT, textWidth } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { makeFrame } from '../ui/Frame';

interface ControlsData {
  /** Where GOT IT goes. A paused scene is resumed; anything else is started. */
  next?: string;
  /** First time: the button says LET'S GO and the loop line is spelled out. */
  first?: boolean;
}

interface Row {
  keys: string[];
  what: string;
}

const KEYBOARD: Row[] = [
  { keys: ['W', 'A', 'S', 'D'], what: 'Move' },
  { keys: ['Q'], what: 'Attack. Hold to charge' },
  { keys: ['SPACE'], what: 'Dash' },
  { keys: ['E'], what: 'Use, open, talk' },
  { keys: ['F'], what: 'Eat food' },
  { keys: ['1', '2'], what: 'Weapon slot' },
  { keys: ['M'], what: 'Map' },
  { keys: ['ESC'], what: 'Pause' },
];

const TOUCH: Row[] = [
  { keys: ['LEFT'], what: 'Touch to move' },
  { keys: ['HIT'], what: 'Attack. Hold to charge' },
  { keys: ['DSH'], what: 'Dash' },
  { keys: ['USE'], what: 'Use, open, talk' },
  { keys: ['EAT'], what: 'Eat food' },
];

const TIPS: string[] = [
  'Hold attack for a 2.5x charged hit',
  'Dash through a hit: next hit crits',
  'Night: double loot, double danger',
  'Cold hurts. Fire and food fix it',
  'Gamepad: stick, A hit, B dash, X use, Y eat',
];

/**
 * One screen that shows every control as a key badge and a verb, the way the
 * prompts in the game do. Shown before the first day, and reachable from the
 * title and the pause menu whenever a key is forgotten.
 */
export class ControlsScene extends Phaser.Scene {
  private next = 'Title';
  private first = false;

  constructor() {
    super('Controls');
  }

  init(data: ControlsData): void {
    this.next = data?.next ?? 'Title';
    this.first = !!data?.first;
  }

  create(): void {
    const { width, height } = BAL.view;

    this.add
      .rectangle(0, 0, width, height, hex(PAL.black))
      .setOrigin(0)
      .setAlpha(this.next === 'World' ? 0.85 : 1);
    this.add
      .bitmapText(Math.round(width / 2), 10, FONT, 'HOW TO PLAY')
      .setOrigin(0.5, 0)
      .setScale(2)
      .setTint(hex(PAL.gold));

    const colW = 218;
    const gap = 12;
    const left = Math.round(width / 2 - colW - gap / 2);
    const right = left + colW + gap;
    const top = 40;

    this.column(left, top, colW, 'KEYBOARD', KEYBOARD, PAL.gold);
    this.column(right, top, colW, 'TOUCH', TOUCH, PAL.cyan);
    this.tips(right, top + TOUCH.length * 15 + 26, colW);

    const loop = this.first
      ? 'Gather by day. Be in the camp zone before dark. Walk into the portal to go.'
      : 'Be back in the camp zone before dark.';
    this.add
      .bitmapText(Math.round(width / 2), height - 46, FONT, loop)
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.cream));

    const bw = 104;
    new Button(
      this,
      Math.round(width / 2 - bw / 2),
      height - 30,
      {
        width: bw,
        height: 20,
        text: this.first ? 'START' : 'GOT IT',
        fill: PAL.rust,
        fillHover: PAL.ember,
        border: PAL.gold,
        textColor: PAL.cream,
      },
      () => this.leave(),
    );

    this.input.keyboard?.once('keydown-ENTER', () => this.leave());
    this.input.keyboard?.once('keydown-ESC', () => this.leave());
  }

  private column(x: number, y: number, w: number, title: string, rows: Row[], color: string): void {
    const rowH = 15;
    makeFrame(this, x, y, w, rows.length * rowH + 20, { edge: color, alpha: 0.92 });
    this.add.bitmapText(x + 6, y + 4, FONT, title).setTint(hex(color));

    let ry = y + 17;
    for (const row of rows) {
      let bx = x + 6;
      for (const key of row.keys) {
        bx += this.badge(bx, ry, key, color) + 3;
      }
      this.add.bitmapText(x + 82, ry + 1, FONT, row.what).setTint(hex(PAL.cream));
      ry += rowH;
    }
  }

  private tips(x: number, y: number, w: number): void {
    const rowH = 13;
    makeFrame(this, x, y, w, TIPS.length * rowH + 20, { edge: PAL.green, alpha: 0.92 });
    this.add.bitmapText(x + 6, y + 4, FONT, 'WORTH KNOWING').setTint(hex(PAL.green));
    let ry = y + 17;
    for (const tip of TIPS) {
      this.add.bitmapText(x + 6, ry, FONT, tip).setTint(hex(PAL.cream));
      ry += rowH;
    }
  }

  /** A key cap: the same gold block and dark letters as the prompts in the game. */
  private badge(x: number, y: number, text: string, color: string): number {
    const w = textWidth(text) + 6;
    this.add.rectangle(x, y, w, 11, hex(color)).setOrigin(0);
    this.add
      .bitmapText(x + Math.round(w / 2), y + 2, FONT, text)
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.black));
    return w;
  }

  private leave(): void {
    const next = this.next;
    this.scene.stop();
    if (this.scene.isPaused(next)) this.scene.resume(next);
    else this.scene.start(next);
  }
}
