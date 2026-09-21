import Phaser from 'phaser';
import { BAL } from '../data/balance';

export interface InputState {
  /** Normalised movement vector, length 0 or 1. */
  moveX: number;
  moveY: number;
  moving: boolean;
  /** Aim direction, normalised. Mouse on desktop, stick or last facing on touch. */
  aimX: number;
  aimY: number;
  attackPressed: boolean;
  attackHeld: boolean;
  dashPressed: boolean;
  interactPressed: boolean;
  swapPressed: boolean;
  menuPressed: boolean;
}

/** What TouchControls writes into each frame. Phase 8 fills this in; keyboard works alone. */
export interface TouchInput {
  active: boolean;
  moveX: number;
  moveY: number;
  attackPressed: boolean;
  attackHeld: boolean;
  dashPressed: boolean;
  interactPressed: boolean;
  swapPressed: boolean;
}

export const touchInput: TouchInput = {
  active: false,
  moveX: 0,
  moveY: 0,
  attackPressed: false,
  attackHeld: false,
  dashPressed: false,
  interactPressed: false,
  swapPressed: false,
};

/**
 * Polled once per frame by whichever scene owns the player. Presses are buffered for
 * BAL.inputBufferMs so an input made during a swing still lands.
 */
export class InputSystem {
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pointerDown = false;
  private pointerWorld = new Phaser.Math.Vector2();
  private usingPointerAim = false;

  private buffer: Record<string, number> = {};
  private lastAim = { x: 0, y: 1 };

  readonly out: InputState = {
    moveX: 0,
    moveY: 0,
    moving: false,
    aimX: 0,
    aimY: 1,
    attackPressed: false,
    attackHeld: false,
    dashPressed: false,
    interactPressed: false,
    swapPressed: false,
    menuPressed: false,
  };

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys(
        'W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,E,Q,ONE,TWO,THREE,ESC,SHIFT,J,K',
      ) as Record<string, Phaser.Input.Keyboard.Key>;
      // Stop the browser scrolling the page on space and arrows.
      kb.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
      kb.on('keydown-SPACE', () => this.press('dash'));
      kb.on('keydown-E', () => this.press('interact'));
      kb.on('keydown-Q', () => this.press('swap'));
      kb.on('keydown-J', () => this.press('attack'));
      kb.on('keydown-ESC', () => this.press('menu'));
    } else {
      this.keys = {};
    }

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (touchInput.active) return;
      this.pointerDown = true;
      this.usingPointerAim = true;
      this.press('attack');
      this.pointerWorld.set(p.worldX, p.worldY);
    });
    scene.input.on('pointerup', () => {
      this.pointerDown = false;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (touchInput.active) return;
      this.usingPointerAim = true;
      this.pointerWorld.set(p.worldX, p.worldY);
    });
  }

  private press(name: string): void {
    this.buffer[name] = this.scene.time.now;
  }

  /** True once, then the buffered press is consumed. */
  private take(name: string): boolean {
    const t = this.buffer[name];
    if (t === undefined) return false;
    if (this.scene.time.now - t > BAL.inputBufferMs) {
      delete this.buffer[name];
      return false;
    }
    delete this.buffer[name];
    return true;
  }

  /** Call once per frame before reading `out`. `originX/Y` is the player, for mouse aim. */
  update(originX: number, originY: number): InputState {
    const k = this.keys;
    const down = (key?: Phaser.Input.Keyboard.Key) => !!key?.isDown;

    let mx = 0;
    let my = 0;
    if (down(k.A) || down(k.LEFT)) mx -= 1;
    if (down(k.D) || down(k.RIGHT)) mx += 1;
    if (down(k.W) || down(k.UP)) my -= 1;
    if (down(k.S) || down(k.DOWN)) my += 1;

    if (touchInput.active && (touchInput.moveX !== 0 || touchInput.moveY !== 0)) {
      mx = touchInput.moveX;
      my = touchInput.moveY;
    }

    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }

    const o = this.out;
    o.moveX = mx;
    o.moveY = my;
    o.moving = len > 0.01;

    // Aim: joystick direction on touch, cursor on desktop, last facing when idle.
    if (touchInput.active) {
      if (o.moving) this.lastAim = { x: mx, y: my };
    } else if (this.usingPointerAim) {
      const dx = this.pointerWorld.x - originX;
      const dy = this.pointerWorld.y - originY;
      const d = Math.hypot(dx, dy);
      if (d > 2) this.lastAim = { x: dx / d, y: dy / d };
    } else if (o.moving) {
      this.lastAim = { x: mx, y: my };
    }
    o.aimX = this.lastAim.x;
    o.aimY = this.lastAim.y;

    if (touchInput.attackPressed) {
      this.press('attack');
      touchInput.attackPressed = false;
    }
    if (touchInput.dashPressed) {
      this.press('dash');
      touchInput.dashPressed = false;
    }
    if (touchInput.interactPressed) {
      this.press('interact');
      touchInput.interactPressed = false;
    }
    if (touchInput.swapPressed) {
      this.press('swap');
      touchInput.swapPressed = false;
    }

    o.attackPressed = this.take('attack');
    o.dashPressed = this.take('dash');
    o.interactPressed = this.take('interact');
    o.swapPressed = this.take('swap');
    o.menuPressed = this.take('menu');
    o.attackHeld = touchInput.active ? touchInput.attackHeld : this.pointerDown || down(k.J);

    return o;
  }

  /** Drop any buffered presses, e.g. when a menu opens. */
  flush(): void {
    this.buffer = {};
  }
}
