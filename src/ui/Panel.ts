import Phaser from 'phaser';
import { RESOURCE_ICON } from '../art/sprites/icons';
import type { ResourceId } from '../data/resources';
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
  /** A resource cost, drawn as icons and numbers instead of the `cost` text. */
  costItems?: Partial<Record<ResourceId, number>>;
  /** A picture of the thing, at the left of the row. Text moves over to make room. */
  icon?: { key: string; scale?: number };
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
  private specs: RowSpec[] = [];
  private cursor: Phaser.GameObjects.Rectangle | null = null;
  private focusIndex = -1;

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
    this.specs = specs;
    this.cursor = null;

    let y = 0;
    for (const spec of specs) {
      const row = this.buildRow(spec, y);
      this.container.add(row);
      this.rows.push(row);
      y += spec.blockedBy ? 34 : 26;
    }
    this.contentHeight = y;
  }

  /** How many rows there are, for a navigator. */
  get count(): number {
    return this.rows.length;
  }

  /** Light the row at `i` and scroll it into view. -1 clears. */
  focusRow(i: number): void {
    this.cursor?.destroy();
    this.cursor = null;
    this.focusIndex = i;
    const row = this.rows[i];
    if (!row) return;
    const h = this.specs[i]?.blockedBy ? 32 : 24;
    this.cursor = this.scene.add
      .rectangle(0, 0, this.width, h)
      .setOrigin(0)
      .setStrokeStyle(2, hex(PAL.white), 0.95);
    row.add(this.cursor);
    // Keep it on screen.
    const top = row.y;
    const bottom = row.y + h;
    if (top < this.scrollY) this.scrollY = top;
    else if (bottom > this.scrollY + this.height) this.scrollY = bottom - this.height;
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, Math.max(0, this.contentHeight - this.height));
    this.container.y = this.y - this.scrollY;
  }

  /** Press the focused row, if it can be pressed. */
  activateRow(i: number): void {
    const spec = this.specs[i];
    if (spec?.onClick) spec.onClick();
  }

  get focused(): number {
    return this.focusIndex;
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

    // The picture. Rows with one start their text further in, so the two columns
    // line up down the whole list.
    const textX = spec.icon ? 32 : 6;
    if (spec.icon && this.scene.textures.exists(spec.icon.key)) {
      const img = this.scene.add
        .image(17, h / 2, spec.icon.key)
        .setOrigin(0.5)
        .setAlpha(spec.state === 'blocked' ? 0.5 : 1);
      // Fit inside a 24 pixel box whatever the source size.
      const fit = 22 / Math.max(img.width, img.height);
      img.setScale(Math.min(fit, spec.icon.scale ?? fit));
      row.add(img);
    }

    const titleColor =
      spec.state === 'owned' ? PAL.green : spec.state === 'affordable' ? PAL.gold : PAL.grey;
    const title = this.scene.add
      .bitmapText(textX, 3, FONT, spec.title)
      .setTint(hex(titleColor));
    row.add(title);

    if (spec.state === 'owned') {
      row.add(
        this.scene.add
          .bitmapText(this.width - 6, 3, FONT, spec.ownedLabel ?? 'BUILT')
          .setOrigin(1, 0)
          .setTint(hex(PAL.green)),
      );
    } else if (spec.costItems && Object.keys(spec.costItems).length > 0) {
      row.add(
        renderCost(this.scene, this.width - 6, 2, spec.costItems, spec.state === 'affordable' ? PAL.cream : PAL.greyDark),
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
        .bitmapText(textX, 13, FONT, spec.effect)
        .setTint(hex(spec.state === 'blocked' ? PAL.greyDark : PAL.cyan)),
    );

    if (spec.blockedBy) {
      row.add(
        this.scene.add
          .bitmapText(textX, 23, FONT, spec.blockedBy)
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

/**
 * A cost as icon-and-number chips, laid out right to left from `rightX`. Numbers
 * next to the thing's own picture read faster than "25W 1C" ever did, and they
 * match the strip at the bottom of the screen.
 */
export function renderCost(
  scene: Phaser.Scene,
  rightX: number,
  y: number,
  cost: Partial<Record<ResourceId, number>>,
  color: string = PAL.cream,
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  let x = rightX;
  const entries = Object.entries(cost).filter(([, n]) => (n ?? 0) > 0).reverse();
  for (const [id, n] of entries) {
    const icon = scene.add.image(x, y + 5, RESOURCE_ICON[id as ResourceId]).setOrigin(1, 0.5).setScale(0.8);
    x -= 10;
    const num = scene.add
      .bitmapText(x, y + 1, FONT, String(n))
      .setOrigin(1, 0)
      .setTint(hex(color));
    x -= num.width + 6;
    out.push(icon, num);
  }
  return out;
}
