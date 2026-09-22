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
  eatPressed: boolean;
  slotPressed: 0 | 1 | 2 | 3;
  menuPressed: boolean;
  mapPressed: boolean;
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
  eatPressed: boolean;
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
  eatPressed: false,
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
  /** Last frame's gamepad button state, for press edges. */
  private padPrev: boolean[] = [];
  private padAttackHeld = false;

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
    eatPressed: false,
    slotPressed: 0,
    menuPressed: false,
    mapPressed: false,
  };

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys(
        'W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,E,Q,R,F,M,ONE,TWO,THREE,ESC,SHIFT',
      ) as Record<string, Phaser.Input.Keyboard.Key>;
      // Stop the browser scrolling the page on space and arrows.
      kb.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
      kb.on('keydown-SPACE', () => this.press('dash'));
      kb.on('keydown-E', () => this.press('interact'));
      // Q attacks and R swaps. Q sits under the fingers already on WASD.
      kb.on('keydown-Q', () => this.press('attack'));
      kb.on('keydown-R', () => this.press('swap'));
      kb.on('keydown-F', () => this.press('eat'));
      kb.on('keydown-ONE', () => this.press('slot1'));
      kb.on('keydown-TWO', () => this.press('slot2'));
      kb.on('keydown-THREE', () => this.press('slot3'));
      kb.on('keydown-ESC', () => this.press('menu'));
      kb.on('keydown-M', () => this.press('map'));
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

    // A gamepad, if one is plugged in. Standard layout: left stick or d-pad moves,
    // A hits (hold to charge), B dashes, X uses, Y eats, bumpers pick a slot,
    // Start pauses, Back opens the map. The right stick aims when pushed.
    const pad = this.scene.input.gamepad?.getPad(0);
    if (pad && pad.connected) {
      const dead = 0.25;
      const ax = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
      const ay = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
      if (Math.hypot(ax, ay) > dead) {
        mx = ax;
        my = ay;
      }
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      if (btn(14)) mx -= 1;
      if (btn(15)) mx += 1;
      if (btn(12)) my -= 1;
      if (btn(13)) my += 1;
      const edge = (i: number, name: string) => {
        const now = btn(i);
        if (now && !this.padPrev[i]) this.press(name);
        this.padPrev[i] = now;
      };
      edge(0, 'attack');
      edge(1, 'dash');
      edge(2, 'interact');
      edge(3, 'eat');
      edge(4, 'slot1');
      edge(5, 'slot2');
      edge(9, 'menu');
      edge(8, 'map');
      this.padAttackHeld = btn(0);
      const rx = pad.axes.length > 2 ? pad.axes[2].getValue() : 0;
      const ry = pad.axes.length > 3 ? pad.axes[3].getValue() : 0;
      if (Math.hypot(rx, ry) > 0.4) {
        const len = Math.hypot(rx, ry);
        this.lastAim = { x: rx / len, y: ry / len };
        this.usingPointerAim = false;
      }
    } else {
      this.padAttackHeld = false;
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
    if (touchInput.eatPressed) {
      this.press('eat');
      touchInput.eatPressed = false;
    }

    o.attackPressed = this.take('attack');
    o.dashPressed = this.take('dash');
    o.interactPressed = this.take('interact');
    o.swapPressed = this.take('swap');
    o.eatPressed = this.take('eat');
    o.slotPressed = this.take('slot1') ? 1 : this.take('slot2') ? 2 : this.take('slot3') ? 3 : 0;
    o.menuPressed = this.take('menu');
    o.mapPressed = this.take('map');
    o.attackHeld = touchInput.active ? touchInput.attackHeld : this.pointerDown || down(k.Q) || this.padAttackHeld;

    return o;
  }

  /** Drop any buffered presses, e.g. when a menu opens. */
  flush(): void {
    this.buffer = {};
  }
}
