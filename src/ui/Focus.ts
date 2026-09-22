import Phaser from 'phaser';

/** Something a cursor can rest on and press. */
export interface Focusable {
  setFocused(on: boolean): void;
  activate(): void;
}

export interface FocusOptions {
  /** Left and right, for tabs or values. */
  onLeft?: () => void;
  onRight?: () => void;
  /** Escape or the B button. */
  onBack?: () => void;
  /** Start with this one lit. */
  start?: number;
  /** Pressed with no items to press: for screens that only need "go on". */
  onPress?: () => void;
  /** Wrap round at the ends. Default true. */
  wrap?: boolean;
}

/**
 * Keyboard and gamepad navigation for a list of buttons or rows. Up and down (or
 * W and S, or the d-pad and left stick) move the cursor, Enter, Space or A press,
 * Escape or B go back, left and right (or the bumpers) hand off to the owner.
 *
 * Every menu in the game uses one of these, so a player with a controller or
 * only a keyboard can do everything a mouse can. The mouse still works: hovering
 * does not move the cursor, so the two never fight.
 */
export class FocusNav {
  private index: number;
  private padPrev: boolean[] = [];
  private stickPrev = 0;
  private keys: Phaser.Input.Keyboard.Key[] = [];

  constructor(
    private scene: Phaser.Scene,
    private items: Focusable[],
    private opts: FocusOptions = {},
  ) {
    this.index = Math.min(Math.max(0, opts.start ?? 0), Math.max(0, items.length - 1));
    const kb = scene.input.keyboard;
    if (kb) {
      const on = (name: string, fn: () => void) => kb.on(`keydown-${name}`, fn);
      on('UP', () => this.move(-1));
      on('W', () => this.move(-1));
      on('DOWN', () => this.move(1));
      on('S', () => this.move(1));
      on('LEFT', () => this.opts.onLeft?.());
      on('A', () => this.opts.onLeft?.());
      on('RIGHT', () => this.opts.onRight?.());
      on('D', () => this.opts.onRight?.());
      on('ENTER', () => this.press());
      on('SPACE', () => this.press());
      on('ESC', () => this.opts.onBack?.());
    }
    this.apply();
    scene.events.once('shutdown', () => this.destroy());
  }

  /** Replace the list, keeping the cursor where it was if it still fits. */
  setItems(items: Focusable[], keepIndex = true): void {
    for (const i of this.items) i.setFocused(false);
    this.items = items;
    this.index = keepIndex ? Math.min(this.index, Math.max(0, items.length - 1)) : 0;
    this.apply();
  }

  get current(): number {
    return this.index;
  }

  move(delta: number): void {
    if (this.items.length === 0) return;
    const wrap = this.opts.wrap ?? true;
    let next = this.index + delta;
    if (wrap) next = (next + this.items.length) % this.items.length;
    else next = Math.min(Math.max(0, next), this.items.length - 1);
    if (next === this.index) return;
    this.index = next;
    this.apply();
  }

  press(): void {
    if (this.items.length === 0) {
      this.opts.onPress?.();
      return;
    }
    this.items[this.index]?.activate();
  }

  /** Call from the scene's update, so a gamepad can drive the menu too. */
  update(): void {
    const pad = this.scene.input.gamepad?.getPad(0);
    if (!pad || !pad.connected) return;
    const btn = (i: number) => !!pad.buttons[i]?.pressed;
    const edge = (i: number, fn: () => void) => {
      const now = btn(i);
      if (now && !this.padPrev[i]) fn();
      this.padPrev[i] = now;
    };
    edge(12, () => this.move(-1));
    edge(13, () => this.move(1));
    edge(14, () => this.opts.onLeft?.());
    edge(15, () => this.opts.onRight?.());
    edge(4, () => this.opts.onLeft?.());
    edge(5, () => this.opts.onRight?.());
    edge(0, () => this.press());
    edge(1, () => this.opts.onBack?.());
    edge(9, () => this.opts.onBack?.());

    // The left stick, stepped so one push is one row.
    const ay = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
    const dir = ay < -0.5 ? -1 : ay > 0.5 ? 1 : 0;
    if (dir !== 0 && this.stickPrev === 0) this.move(dir);
    this.stickPrev = dir;
  }

  private apply(): void {
    this.items.forEach((item, i) => item.setFocused(i === this.index));
  }

  destroy(): void {
    for (const k of this.keys) k.destroy();
    this.keys = [];
  }
}
