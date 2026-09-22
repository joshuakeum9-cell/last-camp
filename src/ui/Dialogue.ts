import Phaser from 'phaser';
import { makeFrame } from './Frame';
import { BAL } from '../data/balance';
import { FONT, wrap } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';

/**
 * A short reading panel. Used for notes, for Mira, and for anything the world says to
 * the player. Deliberately one box and one key: no branching, no portraits, no menus.
 */
export class Dialogue {
  private wrapAt = 62;
  private container?: Phaser.GameObjects.Container;
  private lines: string[] = [];
  private index = 0;
  private onDone?: () => void;
  private locked = false;

  constructor(private scene: Phaser.Scene) {}

  get isOpen(): boolean {
    return !!this.container;
  }

  /** `title` is optional; notes use it for the document's heading. */
  show(lines: string[], title?: string, onDone?: () => void, portrait?: string): void {
    if (lines.length === 0) return;
    this.close();
    this.lines = lines;
    this.index = 0;
    this.onDone = onDone;
    this.build(title, portrait);
    this.locked = true;
    // A short lock stops the same key press that opened it from closing it.
    this.scene.time.delayedCall(160, () => {
      this.locked = false;
    });
  }

  private build(title?: string, portrait?: string): void {
    const { width, height } = BAL.view;
    const boxW = width - 60;
    const boxH = 74;
    const x = 30;
    const y = height - boxH - 22;

    const c = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(8500);
    this.container = c;

    c.add(makeFrame(this.scene, x, y, boxW, boxH, { edge: PAL.gold, alpha: 0.96 }));

    // A picture of who is talking, at the left, the way Stardew and Undertale put a
    // face beside the words. Text moves over to make room.
    let textLeft = x + 8;
    if (portrait && this.scene.textures.exists(portrait)) {
      const face = this.scene.add.image(x + 10, y + boxH - 8, portrait).setOrigin(0, 1).setScale(2);
      const fit = Math.min(2, (boxH - 20) / face.height);
      face.setScale(fit);
      c.add(face);
      textLeft = x + 14 + Math.round(face.displayWidth);
      this.wrapAt = Math.max(30, Math.floor((boxW - (textLeft - x) - 8) / 6));
    } else {
      this.wrapAt = 62;
    }

    let textTop = y + 8;
    if (title) {
      c.add(this.scene.add.bitmapText(textLeft, y + 6, FONT, title).setTint(hex(PAL.gold)));
      c.add(
        this.scene.add
          .rectangle(x + 8, y + 17, boxW - 16, 1, hex(PAL.blueDark))
          .setOrigin(0),
      );
      textTop = y + 22;
    }

    const body = this.scene.add
      .bitmapText(textLeft, textTop, FONT, '')
      .setTint(hex(PAL.cream))
      .setName('body');
    c.add(body);

    const hint = this.scene.add
      .bitmapText(x + boxW - 8, y + boxH - 11, FONT, 'E  more')
      .setOrigin(1, 0)
      .setTint(hex(PAL.uiMuted));
    c.add(hint);

    this.render();
  }

  private render(): void {
    const c = this.container;
    if (!c) return;
    const body = c.getByName('body') as Phaser.GameObjects.BitmapText | null;
    if (!body) return;
    body.setText(wrap(this.lines[this.index] ?? '', this.wrapAt));

    const hint = c.list[c.list.length - 1] as Phaser.GameObjects.BitmapText;
    hint.setText(this.index >= this.lines.length - 1 ? 'E  close' : 'E  more');
  }

  /** Returns true when the press was consumed by the panel. */
  advance(): boolean {
    if (!this.container || this.locked) return !!this.container;
    this.index++;
    if (this.index >= this.lines.length) {
      this.close();
      this.onDone?.();
      return true;
    }
    this.render();
    return true;
  }

  close(): void {
    this.container?.destroy(true);
    this.container = undefined;
  }
}
