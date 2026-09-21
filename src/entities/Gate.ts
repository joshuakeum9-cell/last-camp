import Phaser from 'phaser';
import { bus } from '../core/EventBus';
import { state } from '../core/GameState';
import { GATES, type GateDef, type GateId } from '../data/areas';
import { TILE, TILE_SIZE } from '../art/sprites/tiles';
import { hex, PAL } from '../art/palette';
import { Juice } from '../systems/Juice';

/**
 * A barrier across a corridor. Two of them open by being hit, which makes reaching the
 * den and the hollow an act rather than a walk. The third never opens in this version,
 * and says so.
 */
export class Gate {
  readonly def: GateDef;
  private hitsLeft: number;
  private open: boolean;
  private shakeTargets: Phaser.Tilemaps.Tile[] = [];
  private hint?: Phaser.GameObjects.BitmapText;

  constructor(
    private scene: Phaser.Scene,
    id: GateId,
    private layer: Phaser.Tilemaps.TilemapLayer,
    private juice: Juice,
  ) {
    this.def = GATES[id];
    this.open = state.map.openedGates.includes(id);
    this.hitsLeft = this.def.hits;
    if (this.open) this.clearTiles();
  }

  get id(): GateId {
    return this.def.id;
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Hidden gates give no prompt until the player is standing on top of them. */
  get isHidden(): boolean {
    return !!this.def.hidden && !state.map.secretFound;
  }

  get centerX(): number {
    return ((this.def.rect.x0 + this.def.rect.x1) / 2) * TILE_SIZE;
  }

  get centerY(): number {
    return ((this.def.rect.y0 + this.def.rect.y1) / 2) * TILE_SIZE;
  }

  inRange(px: number, py: number): boolean {
    if (this.open) return false;
    const dx = Math.abs(px - this.centerX);
    const dy = Math.abs(py - this.centerY);
    const halfW = ((this.def.rect.x1 - this.def.rect.x0) / 2) * TILE_SIZE;
    const halfH = ((this.def.rect.y1 - this.def.rect.y0) / 2) * TILE_SIZE;
    return dx < halfW + 22 && dy < halfH + 22;
  }

  get prompt(): string {
    if (this.open) return '';
    if (this.def.kind === 'locked') return 'E  LOOK';
    return this.isHidden ? 'E  LISTEN' : `E  BREAK THROUGH  (${this.hitsLeft})`;
  }

  /**
   * Interacting is what breaks it, rather than a weapon swing, so the player never
   * wonders whether they are hitting the wall or the air.
   */
  strike(): string | null {
    if (this.open) return null;

    if (this.def.kind === 'locked') {
      bus.emit('audio:play', { cue: 'lockedGate' });
      return this.def.message;
    }

    // The hidden one announces itself on the first touch, then behaves normally.
    if (this.isHidden) {
      state.map.secretFound = true;
      bus.emit('secret:found', {});
      this.juice.ring(this.centerX, this.centerY, PAL.cyan, 46, 500);
      return this.def.message;
    }

    this.hitsLeft--;
    this.juice.sparks(this.centerX, this.centerY, PAL.white, 10, 130);
    bus.emit('juice:shake', { intensity: 3, ms: 120 });
    bus.emit('audio:play', { cue: 'smash' });
    this.shakeTiles();

    if (this.hitsLeft > 0) return null;

    this.open = true;
    if (!state.map.openedGates.includes(this.def.id)) {
      state.map.openedGates.push(this.def.id);
    }
    this.clearTiles();
    this.juice.ring(this.centerX, this.centerY, PAL.white, 70, 600);
    bus.emit('juice:shake', { intensity: 6, ms: 220 });
    bus.emit('audio:play', { cue: 'gateOpen' });
    return 'It gives way.';
  }

  private shakeTiles(): void {
    const cam = this.scene.cameras.main;
    void cam;
    for (const tile of this.tiles()) {
      tile.alpha = 0.7;
    }
    this.scene.time.delayedCall(120, () => {
      for (const tile of this.tiles()) tile.alpha = 1;
    });
  }

  private tiles(): Phaser.Tilemaps.Tile[] {
    if (this.shakeTargets.length) return this.shakeTargets;
    const list: Phaser.Tilemaps.Tile[] = [];
    for (let y = this.def.rect.y0; y < this.def.rect.y1; y++) {
      for (let x = this.def.rect.x0; x < this.def.rect.x1; x++) {
        const tile = this.layer.getTileAt(x, y);
        if (tile) list.push(tile);
      }
    }
    this.shakeTargets = list;
    return list;
  }

  /** Replace the barrier with walkable ground. */
  private clearTiles(): void {
    const ground = this.def.id === 'secretIce' ? TILE.ICE_A : TILE.DEEP_A;
    for (let y = this.def.rect.y0; y < this.def.rect.y1; y++) {
      for (let x = this.def.rect.x0; x < this.def.rect.x1; x++) {
        this.layer.putTileAt(ground, x, y);
        const tile = this.layer.getTileAt(x, y);
        if (tile) tile.setCollision(false, false, false, false);
      }
    }
    void hex;
  }
}
