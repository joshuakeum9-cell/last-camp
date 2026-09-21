import Phaser from 'phaser';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';

export type LabelOutline = 'none' | 'shadow' | 'full';

export interface LabelOptions {
  color?: string;
  scale?: number;
  /** 'full' rings the text on four sides, 'shadow' offsets one dark copy. */
  outline?: LabelOutline;
  outlineColor?: string;
  originX?: number;
  originY?: number;
  align?: 'left' | 'center';
}

/**
 * Text that stays readable on top of the world.
 *
 * The wilderness is deliberately bright, which means flat text sits on it invisibly.
 * Every label drawn over the game gets a dark ring or a dark offset copy behind it, so
 * the colour of the text can stay meaningful (gold for a prompt, cyan for cold) without
 * the colour being the only thing keeping it legible.
 *
 * 'full' costs five draw calls and is for anything that persists. 'shadow' costs two and
 * is for things that appear in numbers, like damage.
 */
export class Label {
  readonly container: Phaser.GameObjects.Container;
  private main: Phaser.GameObjects.BitmapText;
  private outlines: Phaser.GameObjects.BitmapText[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    opts: LabelOptions = {},
  ) {
    const {
      color = PAL.white,
      scale = 1,
      outline = 'full',
      outlineColor = '#04060f',
      originX = 0,
      originY = 0,
      align = 'left',
    } = opts;

    this.container = scene.add.container(x, y);

    const offsets: Array<[number, number]> =
      outline === 'full'
        ? [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]
        : outline === 'shadow'
          ? [[1, 1]]
          : [];

    for (const [ox, oy] of offsets) {
      const copy = scene.add
        .bitmapText(ox * scale, oy * scale, FONT, text)
        .setOrigin(originX, originY)
        .setScale(scale)
        .setTint(hex(outlineColor));
      if (align === 'center') copy.setCenterAlign();
      this.outlines.push(copy);
      this.container.add(copy);
    }

    this.main = scene.add
      .bitmapText(0, 0, FONT, text)
      .setOrigin(originX, originY)
      .setScale(scale)
      .setTint(hex(color));
    if (align === 'center') this.main.setCenterAlign();
    this.container.add(this.main);
  }

  setText(text: string): this {
    if (this.main.text === text) return this;
    this.main.setText(text);
    for (const o of this.outlines) o.setText(text);
    return this;
  }

  get text(): string {
    return this.main.text;
  }

  setTint(color: string): this {
    this.main.setTint(hex(color));
    return this;
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(Math.round(x), Math.round(y));
    return this;
  }

  setScale(scale: number): this {
    this.main.setScale(scale);
    for (const [i, o] of this.outlines.entries()) {
      o.setScale(scale);
      const dir = OUTLINE_DIRS[i] ?? [1, 1];
      o.setPosition(dir[0] * scale, dir[1] * scale);
    }
    return this;
  }

  setAlpha(alpha: number): this {
    this.container.setAlpha(alpha);
    return this;
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  setDepth(depth: number): this {
    this.container.setDepth(depth);
    return this;
  }

  setScrollFactor(factor: number): this {
    this.container.setScrollFactor(factor);
    return this;
  }

  get x(): number {
    return this.container.x;
  }

  set x(value: number) {
    this.container.x = value;
  }

  get y(): number {
    return this.container.y;
  }

  set y(value: number) {
    this.container.y = value;
  }

  get width(): number {
    return this.main.width;
  }

  /** The container, for tweening position and alpha. */
  get target(): Phaser.GameObjects.Container {
    return this.container;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

const OUTLINE_DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
