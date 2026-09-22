import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { state } from '../core/GameState';
import { touchInput } from '../core/InputSystem';
import { hex, PAL } from '../art/palette';
import { FONT } from '../art/PixelFont';

interface TouchButton {
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.BitmapText;
  radius: number;
  x: number;
  y: number;
  pointerId: number | null;
}

/**
 * A joystick on the left and three buttons on the right. Nothing sits in the top third
 * of the screen, the stick follows the first finger down on the left half, and the
 * interact button only appears when there is something to interact with.
 */
export class TouchControls {
  private base!: Phaser.GameObjects.Arc;
  private knob!: Phaser.GameObjects.Arc;
  private stickPointer: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2();

  private attack!: TouchButton;
  private dash!: TouchButton;
  private interact!: TouchButton;
  private swap!: TouchButton;
  private eat!: TouchButton;
  private enabled = false;

  constructor(private scene: Phaser.Scene) {
    this.build();
    this.setEnabled(this.shouldShow());

    scene.input.addPointer(2);
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.events.once('shutdown', () => this.destroy());
  }

  private shouldShow(): boolean {
    return touchControlsWanted(this.scene);
  }

  private build(): void {
    const { width, height } = BAL.view;
    const alpha = state.settings.touchOpacity;

    // --- stick, bottom left ---------------------------------------------
    const sx = Math.round(width * 0.14);
    const sy = Math.round(height * 0.74);
    this.stickOrigin.set(sx, sy);

    this.base = this.scene.add
      .circle(sx, sy, 26, hex(PAL.navy), alpha * 0.6)
      .setStrokeStyle(2, hex(PAL.ice), alpha)
      .setScrollFactor(0)
      .setDepth(9000);
    this.knob = this.scene.add
      .circle(sx, sy, 11, hex(PAL.ice), alpha)
      .setScrollFactor(0)
      .setDepth(9001);

    // --- buttons, bottom right ------------------------------------------
    this.attack = this.makeButton(width - 34, height - 34, 24, 'HIT', PAL.ember);
    this.dash = this.makeButton(width - 74, height - 26, 17, 'DSH', PAL.ice);
    this.swap = this.makeButton(width - 30, height - 82, 14, 'SWP', PAL.gold);
    this.interact = this.makeButton(width - 76, height - 74, 17, 'USE', PAL.gold);
    this.eat = this.makeButton(width - 118, height - 40, 14, 'EAT', PAL.green);
    this.setButtonVisible(this.interact, false);
    this.setButtonVisible(this.swap, false);
  }

  private makeButton(x: number, y: number, radius: number, text: string, color: string): TouchButton {
    const alpha = state.settings.touchOpacity;
    const circle = this.scene.add
      .circle(x, y, radius, hex(PAL.navy), alpha * 0.6)
      .setStrokeStyle(2, hex(color), alpha)
      .setScrollFactor(0)
      .setDepth(9000);
    const label = this.scene.add
      .bitmapText(x, y - 4, FONT, text)
      .setOrigin(0.5, 0)
      .setTint(hex(color))
      .setAlpha(alpha)
      .setScrollFactor(0)
      .setDepth(9001);
    return { circle, label, radius, x, y, pointerId: null };
  }

  private setButtonVisible(btn: TouchButton, on: boolean): void {
    btn.circle.setVisible(on && this.enabled);
    btn.label.setVisible(on && this.enabled);
  }

  // --- pointer handling --------------------------------------------------

  private toLocal(p: Phaser.Input.Pointer): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    return { x: p.x - cam.x, y: p.y - cam.y };
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    const { x, y } = this.toLocal(p);

    for (const btn of [this.attack, this.dash, this.interact, this.swap, this.eat]) {
      if (!btn.circle.visible) continue;
      if (Phaser.Math.Distance.Between(x, y, btn.x, btn.y) > btn.radius + 8) continue;
      btn.pointerId = p.id;
      btn.circle.setFillStyle(hex(PAL.white), state.settings.touchOpacity);
      if (btn === this.attack) {
        touchInput.attackPressed = true;
        touchInput.attackHeld = true;
      }
      if (btn === this.dash) touchInput.dashPressed = true;
      if (btn === this.interact) touchInput.interactPressed = true;
      if (btn === this.swap) touchInput.swapPressed = true;
      if (btn === this.eat) touchInput.eatPressed = true;
      return;
    }

    // The stick follows the first finger down anywhere in the left half.
    if (this.stickPointer === null && x < BAL.view.width * 0.45) {
      this.stickPointer = p.id;
      this.stickOrigin.set(x, y);
      this.base.setPosition(x, y);
      this.knob.setPosition(x, y);
    }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.enabled || this.stickPointer !== p.id) return;
    const { x, y } = this.toLocal(p);
    const dx = x - this.stickOrigin.x;
    const dy = y - this.stickOrigin.y;
    const dist = Math.hypot(dx, dy);
    const max = 26;
    const clamped = Math.min(dist, max);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    this.knob.setPosition(this.stickOrigin.x + nx * clamped, this.stickOrigin.y + ny * clamped);

    // A deadzone, so resting a thumb does not drift the survivor into a wolf.
    const dead = max * 0.12;
    if (dist < dead) {
      touchInput.moveX = 0;
      touchInput.moveY = 0;
    } else {
      const strength = Math.min(1, (dist - dead) / (max - dead));
      touchInput.moveX = nx * strength;
      touchInput.moveY = ny * strength;
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.stickPointer === p.id) {
      this.stickPointer = null;
      touchInput.moveX = 0;
      touchInput.moveY = 0;
      this.knob.setPosition(this.stickOrigin.x, this.stickOrigin.y);
    }
    for (const btn of [this.attack, this.dash, this.interact, this.swap, this.eat]) {
      if (btn.pointerId !== p.id) continue;
      btn.pointerId = null;
      btn.circle.setFillStyle(hex(PAL.navy), state.settings.touchOpacity * 0.6);
      if (btn === this.attack) touchInput.attackHeld = false;
    }
  }

  // --- per-frame ---------------------------------------------------------

  /** `canInteract` shows the contextual button; `hasSecond` shows the swap button. */
  update(canInteract: boolean, hasSecond: boolean, canEat = false): void {
    if (!this.enabled) return;
    this.setButtonVisible(this.interact, canInteract);
    this.setButtonVisible(this.swap, hasSecond);
    this.setButtonVisible(this.eat, canEat);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    touchInput.active = on;
    this.base.setVisible(on);
    this.knob.setVisible(on);
    this.setButtonVisible(this.attack, on);
    this.setButtonVisible(this.dash, on);
    this.setButtonVisible(this.eat, false);
    if (!on) {
      touchInput.moveX = 0;
      touchInput.moveY = 0;
      touchInput.attackHeld = false;
    }
  }

  refreshSettings(): void {
    this.setEnabled(this.shouldShow());
    const alpha = state.settings.touchOpacity;
    this.base.setAlpha(alpha);
    this.knob.setAlpha(alpha);
    for (const btn of [this.attack, this.dash, this.interact, this.swap, this.eat]) {
      btn.circle.setAlpha(alpha);
      btn.label.setAlpha(alpha);
    }
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    touchInput.active = false;
    this.base.destroy();
    this.knob.destroy();
    for (const btn of [this.attack, this.dash, this.interact, this.swap, this.eat]) {
      btn.circle.destroy();
      btn.label.destroy();
    }
  }
}

/** Whether the on-screen controls are shown, per the setting or, on auto, the device. */
export function touchControlsWanted(scene: Phaser.Scene): boolean {
  if (state.settings.showTouch === 'on') return true;
  if (state.settings.showTouch === 'off') return false;
  return scene.sys.game.device.input.touch;
}
