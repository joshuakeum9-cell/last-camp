import Phaser from 'phaser';
import { FONT, textWidth } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { touchInput } from '../core/InputSystem';
import { drawFrame } from './Frame';

/**
 * The interaction prompt: a key badge and a verb, on a small panel above the player.
 *
 * It replaces a bare "E" label, which told keyboard players which key but not what it
 * did, and told touch players nothing at all. The badge shows the key on a keyboard and
 * a tap mark on a touch screen, and the verb always says what will happen.
 */
export class Prompt {
  readonly container: Phaser.GameObjects.Container;
  private panel: Phaser.GameObjects.Graphics;
  private badge: Phaser.GameObjects.Rectangle;
  private badgeText: Phaser.GameObjects.BitmapText;
  private verb: Phaser.GameObjects.BitmapText;
  private current = '';
  private totalW = 60;
  private bobTween?: Phaser.Tweens.Tween;

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setDepth(7500).setVisible(false);

    this.panel = scene.add.graphics();
    drawFrame(this.panel, -30, -8, 60, 16, { fill: PAL.black, alpha: 0.85, edge: PAL.gold });

    this.badge = scene.add.rectangle(0, 0, 11, 10, hex(PAL.gold)).setOrigin(0, 0.5);
    this.badgeText = scene.add
      .bitmapText(0, 0, FONT, 'E')
      .setOrigin(0.5, 0.5)
      .setTint(hex(PAL.black));

    this.verb = scene.add.bitmapText(0, 0, FONT, '').setOrigin(0, 0.5).setTint(hex(PAL.cream));

    this.container.add([this.panel, this.badge, this.badgeText, this.verb]);
  }

  /**
   * `verb` is what will happen: "Open", "Read", "Return to camp". The key is added
   * here, so callers never hardcode it.
   */
  show(verb: string, x: number, y: number): void {
    const keyLabel = touchInput.active ? 'TAP' : 'E';
    const text = verb.toUpperCase();

    if (this.current !== text || this.badgeText.text !== keyLabel) {
      this.current = text;
      this.verb.setText(text);
      this.badgeText.setText(keyLabel);

      const badgeW = textWidth(keyLabel) + 6;
      const verbW = textWidth(text);
      const pad = 4;
      const gap = 4;
      const totalW = pad + badgeW + gap + verbW + pad;
      const left = -Math.round(totalW / 2);

      drawFrame(this.panel, left, -8, totalW, 16, { fill: PAL.black, alpha: 0.85, edge: PAL.gold });
      this.totalW = totalW;
      this.badge.setSize(badgeW, 10);
      this.badge.x = left + pad;
      this.badgeText.x = left + pad + Math.round(badgeW / 2);
      this.badgeText.y = 1;
      this.verb.x = left + pad + badgeW + gap;
      this.verb.y = 1;
    }

    // Keep the whole panel on screen when the player stands at a map edge.
    const view = this.scene.cameras.main.worldView;
    const half = this.totalW / 2 + 2;
    x = Phaser.Math.Clamp(x, view.x + half, view.right - half);
    y = Math.max(y, view.y + 10);

    const wasHidden = !this.container.visible;
    this.container.setPosition(Math.round(x), Math.round(y)).setVisible(true);

    if (wasHidden) {
      // A short rise on appearance, so it is noticed without being loud.
      this.container.setAlpha(0);
      this.container.y += 4;
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        y: Math.round(y),
        duration: 120,
        ease: 'Quad.easeOut',
      });
    }
  }

  hide(): void {
    if (!this.container.visible) return;
    this.container.setVisible(false);
    this.current = '';
    this.bobTween?.stop();
  }

  get visible(): boolean {
    return this.container.visible;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
