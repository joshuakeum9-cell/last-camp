import Phaser from 'phaser';
import { hex, PAL } from '../art/palette';

export interface BarOptions {
  width: number;
  height: number;
  fill: string;
  /** Drawn behind the fill and eased down after damage, so a hit reads as a hit. */
  ghost?: string;
  back?: string;
  border?: string;
}

/**
 * A pixel meter. Health and cold both use it. The ghost layer is what makes losing
 * health legible at a glance.
 */
export class Bar {
  readonly container: Phaser.GameObjects.Container;
  private backRect: Phaser.GameObjects.Rectangle;
  private ghostRect?: Phaser.GameObjects.Rectangle;
  private fillRect: Phaser.GameObjects.Rectangle;
  private borderRect: Phaser.GameObjects.Rectangle;
  private value = 1;
  private ghostValue = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private opts: BarOptions,
  ) {
    const { width, height } = opts;
    this.container = scene.add.container(x, y);

    this.backRect = scene.add
      .rectangle(0, 0, width, height, hex(opts.back ?? PAL.navy))
      .setOrigin(0);
    this.container.add(this.backRect);

    if (opts.ghost) {
      this.ghostRect = scene.add
        .rectangle(1, 1, width - 2, height - 2, hex(opts.ghost))
        .setOrigin(0);
      this.container.add(this.ghostRect);
    }

    this.fillRect = scene.add
      .rectangle(1, 1, width - 2, height - 2, hex(opts.fill))
      .setOrigin(0);
    this.container.add(this.fillRect);

    this.borderRect = scene.add
      .rectangle(0, 0, width, height)
      .setOrigin(0)
      .setStrokeStyle(1, hex(opts.border ?? PAL.black));
    this.container.add(this.borderRect);
  }

  /** `t` is 0..1. Call every frame; the ghost eases itself. */
  set(t: number): void {
    this.value = Phaser.Math.Clamp(t, 0, 1);
    const inner = this.opts.width - 2;
    this.fillRect.width = Math.max(0, Math.round(inner * this.value));
    this.fillRect.setVisible(this.value > 0);
  }

  update(dt: number): void {
    if (!this.ghostRect) return;
    const inner = this.opts.width - 2;
    if (this.ghostValue > this.value) {
      this.ghostValue = Math.max(this.value, this.ghostValue - (dt / 1000) * 0.7);
    } else {
      this.ghostValue = this.value;
    }
    this.ghostRect.width = Math.max(0, Math.round(inner * this.ghostValue));
    this.ghostRect.setVisible(this.ghostValue > this.value + 0.001);
  }

  setFillColor(color: string): void {
    this.fillRect.setFillStyle(hex(color));
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(x, y);
    return this;
  }

  setDepth(d: number): this {
    this.container.setDepth(d);
    return this;
  }

  setScrollFactor(f: number): this {
    this.container.setScrollFactor(f);
    return this;
  }

  setVisible(v: boolean): this {
    this.container.setVisible(v);
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }
}
