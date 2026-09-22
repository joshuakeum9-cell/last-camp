import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { drawFrame } from './Frame';

export interface ChoiceRow {
  /** The line the player reads first. Numbered automatically. */
  label: string;
  /** What it gives, in teal. Optional. */
  boon?: string;
  /** What it costs, in red. Optional. */
  cost?: string;
}

export interface ChoiceListOptions {
  title: string;
  rows: ChoiceRow[];
  onPick: (index: number) => void;
  /** Called when the player backs out. Leave it out to make the list compulsory. */
  onCancel?: () => void;
  /** The frame's edge, which is how each list says what kind of thing it is. */
  edge?: string;
  width?: number;
  /** Pushes the whole thing down from the middle of the screen. */
  offsetY?: number;
}

/**
 * The pick-one list: a framed panel of numbered rows, chosen with 1, 2, 3 or a tap.
 *
 * Four different things in this game ask the player to pick one of a few
 * (what to ask Mira, which boss to fight again, which pact to take, what to do
 * about the thing out on the ice) and each had grown its own copy of the same
 * panel. They are one component now, so they look identical, they all take the
 * same keys, and a fifth one costs nothing.
 */
export class ChoiceList {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private onPick: (index: number) => void;
  private onCancel?: () => void;
  readonly count: number;

  constructor(scene: Phaser.Scene, opts: ChoiceListOptions) {
    this.onPick = opts.onPick;
    this.onCancel = opts.onCancel;
    this.count = opts.rows.length;

    const { width, height } = BAL.view;
    const w = opts.width ?? 268;
    // A row is one line, or two or three when it explains itself.
    const rowH = opts.rows.some((r) => r.cost) ? 28 : opts.rows.some((r) => r.boon) ? 22 : 14;
    const h = 22 + opts.rows.length * rowH + 20;
    const x = Math.round(width / 2 - w / 2);
    const y = Math.round(height / 2 - h / 2) + (opts.offsetY ?? 20);

    const frame = scene.add.graphics().setScrollFactor(0).setDepth(8600);
    drawFrame(frame, x, y, w, h, { edge: opts.edge ?? PAL.gold, alpha: 0.96 });
    this.objects.push(
      frame,
      scene.add.bitmapText(x + 8, y + 6, FONT, opts.title).setTint(hex(opts.edge ?? PAL.gold)).setScrollFactor(0).setDepth(8601),
    );

    if (this.onCancel) {
      this.objects.push(
        scene.add
          .bitmapText(x + w - 8, y + 6, FONT, 'E steps back')
          .setOrigin(1, 0)
          .setTint(hex(PAL.uiMuted))
          .setScrollFactor(0)
          .setDepth(8601)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            scene.input.stopPropagation();
            this.cancel();
          }),
      );
    }

    opts.rows.forEach((row, i) => {
      const ry = y + 22 + i * rowH;
      const hit = scene.add
        .rectangle(x + 6, ry - 3, w - 12, rowH - 2, hex(PAL.deep))
        .setOrigin(0)
        .setAlpha(0.3)
        .setScrollFactor(0)
        .setDepth(8601)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        scene.input.stopPropagation();
        this.pick(i);
      });
      this.objects.push(
        hit,
        scene.add.bitmapText(x + 10, ry, FONT, `${i + 1}  ${row.label}`).setTint(hex(PAL.cream)).setScrollFactor(0).setDepth(8602),
      );
      if (row.boon) {
        this.objects.push(
          scene.add.bitmapText(x + 10, ry + 9, FONT, row.boon).setTint(hex(PAL.teal)).setScrollFactor(0).setDepth(8602),
        );
      }
      if (row.cost) {
        this.objects.push(
          scene.add.bitmapText(x + 10, ry + 18, FONT, row.cost).setTint(hex(PAL.blood)).setScrollFactor(0).setDepth(8602),
        );
      }
    });

    this.objects.push(
      scene.add
        .bitmapText(x + Math.round(w / 2), y + h - 13, FONT, this.hint(opts.rows.length))
        .setOrigin(0.5, 0)
        .setTint(hex(PAL.uiMuted))
        .setScrollFactor(0)
        .setDepth(8602),
    );
  }

  private hint(n: number): string {
    if (n === 1) return 'Press 1, or tap it';
    if (n === 2) return 'Press 1 or 2, or tap one';
    return `Press 1 to ${n}, or tap one`;
  }

  /** Feed this the frame's input: returns true while the list is still up. */
  handle(slotPressed: number, backPressed: boolean): boolean {
    if (slotPressed) this.pick(slotPressed - 1);
    else if (backPressed) this.cancel();
    return true;
  }

  private pick(i: number): void {
    if (i < 0 || i >= this.count) return;
    this.onPick(i);
  }

  private cancel(): void {
    this.onCancel?.();
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }
}
