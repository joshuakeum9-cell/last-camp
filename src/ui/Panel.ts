import Phaser from 'phaser';
import { FONT, wrap } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';

export interface RowSpec {
  title: string;
  /** One line of what it does, in plain words. */
  effect: string;
  /** Cost chips, e.g. "10 wood  1 crystal". Empty when free or owned. */
  cost: string;
  /** What an owned row says instead of BUILT, for lists that are not upgrades. */
  ownedLabel?: string;
  /** Shown under the effect when the row cannot be taken. */
  blockedBy?: string | null;
  state: 'affordable' | 'blocked' | 'owned';
  onClick?: () => void;
}

/**
 * A scrolling list of purchasable rows. Newly affordable rows pulse gold, so the eye
 * goes to what the last expedition just unlocked.
 */
export class RowList {
  readonly container: Phaser.GameObjects.Container;
  private rows: Phaser.GameObjects.Container[] = [];
  private scrollY = 0;
  private contentHeight = 0;
  private mask?: Phaser.Display.Masks.GeometryMask;

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    private width: number,
    private height: number,
  ) {
    this.container = scene.add.container(x, y);

    const shape = scene.make.graphics({});
    shape.fillStyle(0xffffff);
    shape.fillRect(x, y, width, height);
    this.mask = shape.createGeometryMask();
    this.container.setMask(this.mask);

    scene.input.on('wheel', this.onWheel, this);
  }

  private onWheel(_p: unknown, _o: unknown, _dx: number, dy: number): void {
    if (this.contentHeight <= this.height) return;
    this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.4, 0, this.contentHeight - this.height);
    this.container.y = this.y - this.scrollY;
  }

  setRows(specs: RowSpec[]): void {
    for (const r of this.rows) r.destroy();
    this.rows = [];
    this.container.removeAll(false);
    this.scrollY = 0;
    this.container.y = this.y;

    let y = 0;
    for (const spec of specs) {
      const row = this.buildRow(spec, y);
      this.container.add(row);
      this.rows.push(row);
      y += spec.blockedBy ? 34 : 26;
    }
    this.contentHeight = y;
  }

  private buildRow(spec: RowSpec, y: number): Phaser.GameObjects.Container {
    const row = this.scene.add.container(0, y);
    const h = spec.blockedBy ? 32 : 24;

    const bgColor =
      spec.state === 'owned' ? PAL.deep : spec.state === 'affordable' ? '#1a2f6b' : PAL.navy;
    const bg = this.scene.add
      .rectangle(0, 0, this.width, h, hex(bgColor))
      .setOrigin(0)
      .setAlpha(spec.state === 'blocked' ? 0.55 : 0.9);
    row.add(bg);

    const titleColor =
      spec.state === 'owned' ? PAL.green : spec.state === 'affordable' ? PAL.gold : PAL.grey;
    const title = this.scene.add
      .bitmapText(6, 3, FONT, spec.title)
      .setTint(hex(titleColor));
    row.add(title);

    if (spec.state === 'owned') {
      row.add(
        this.scene.add
          .bitmapText(this.width - 6, 3, FONT, spec.ownedLabel ?? 'BUILT')
          .setOrigin(1, 0)
          .setTint(hex(PAL.green)),
      );
    } else if (spec.cost) {
      row.add(
        this.scene.add
          .bitmapText(this.width - 6, 3, FONT, spec.cost)
          .setOrigin(1, 0)
          .setTint(hex(spec.state === 'affordable' ? PAL.cream : PAL.greyDark)),
      );
    }

    row.add(
      this.scene.add
        .bitmapText(6, 13, FONT, spec.effect)
        .setTint(hex(spec.state === 'blocked' ? PAL.greyDark : PAL.cyan)),
    );

    if (spec.blockedBy) {
      row.add(
        this.scene.add
          .bitmapText(6, 23, FONT, spec.blockedBy)
          .setTint(hex(PAL.rust)),
      );
    }

    if (spec.state === 'affordable' && spec.onClick) {
      // Pulse, so the player sees at a glance what the day just paid for.
      this.scene.tweens.add({
        targets: bg,
        alpha: 0.55,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setStrokeStyle(1, hex(PAL.white)))
        .on('pointerout', () => bg.setStrokeStyle(0))
        .on('pointerup', () => spec.onClick?.());
    }

    return row;
  }

  destroy(): void {
    this.scene.input.off('wheel', this.onWheel, this);
    for (const r of this.rows) r.destroy();
    this.container.destroy();
    this.mask?.destroy();
    void wrap;
  }
}
