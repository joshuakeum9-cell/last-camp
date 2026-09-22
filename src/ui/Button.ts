import Phaser from 'phaser';
import { FONT, textWidth } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fill?: string;
  fillHover?: string;
  border?: string;
  text?: string;
  textColor?: string;
  textHover?: string;
  align?: 'center' | 'left';
  padX?: number;
  enabled?: boolean;
}

/** A pixel button that works with a mouse and a finger, and looks the same for both. */
export class Button {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.BitmapText;
  private opts: Required<ButtonOptions>;
  private enabled: boolean;
  private hovered = false;
  private focused = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
    opts: ButtonOptions,
    private onClick: () => void,
  ) {
    const text = opts.text ?? '';
    this.opts = {
      width: opts.width ?? Math.max(48, textWidth(text) + 16),
      height: opts.height ?? 16,
      fill: opts.fill ?? PAL.deep,
      fillHover: opts.fillHover ?? PAL.blueDark,
      border: opts.border ?? PAL.ice,
      text,
      textColor: opts.textColor ?? PAL.cyan,
      textHover: opts.textHover ?? PAL.white,
      align: opts.align ?? 'center',
      padX: opts.padX ?? 6,
      enabled: opts.enabled ?? true,
    };
    this.enabled = this.opts.enabled;

    const { width, height } = this.opts;
    this.container = scene.add.container(x, y);

    this.bg = scene.add.rectangle(0, 0, width, height, hex(this.opts.fill)).setOrigin(0);
    this.border = scene.add
      .rectangle(0, 0, width, height)
      .setOrigin(0)
      .setStrokeStyle(1, hex(this.opts.border));

    const tx = this.opts.align === 'center' ? Math.round(width / 2) : this.opts.padX;
    this.label = scene.add
      .bitmapText(tx, Math.round(height / 2) - 4, FONT, this.opts.text)
      .setOrigin(this.opts.align === 'center' ? 0.5 : 0, 0)
      .setTint(hex(this.opts.textColor));

    this.container.add([this.bg, this.border, this.label]);

    this.bg
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.setHover(true))
      .on('pointerout', () => this.setHover(false))
      .on('pointerdown', () => {
        if (!this.enabled) return;
        this.container.y += 1;
      })
      .on('pointerup', () => {
        if (!this.enabled) return;
        this.container.y -= 1;
        this.onClick();
      });

    this.refresh();
  }

  private setHover(on: boolean): void {
    this.hovered = on;
    this.refresh();
  }

  /** The keyboard or gamepad cursor is on this button. Drawn like a hover, plus a lit edge. */
  setFocused(on: boolean): void {
    this.focused = on;
    this.refresh();
  }

  /** Press it, from a key or a pad. */
  activate(): void {
    if (!this.enabled) return;
    this.onClick();
  }

  private refresh(): void {
    if (!this.enabled) {
      this.bg.setFillStyle(hex(PAL.navy));
      this.border.setStrokeStyle(1, hex(PAL.uiMuted));
      this.label.setTint(hex(PAL.uiMuted));
      return;
    }
    const lit = this.hovered || this.focused;
    this.bg.setFillStyle(hex(lit ? this.opts.fillHover : this.opts.fill));
    this.border.setStrokeStyle(this.focused ? 2 : 1, hex(lit ? PAL.white : this.opts.border));
    this.label.setTint(hex(lit ? this.opts.textHover : this.opts.textColor));
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.refresh();
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

  get width(): number {
    return this.opts.width;
  }

  get height(): number {
    return this.opts.height;
  }

  destroy(): void {
    this.container.destroy();
    void this.scene;
  }
}
