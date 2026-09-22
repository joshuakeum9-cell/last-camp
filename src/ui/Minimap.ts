import Phaser from 'phaser';
import { AREA_LIST, RETURN_ZONE } from '../data/areas';
import { state } from '../core/GameState';
import { hex, PAL } from '../art/palette';
import { TILE_SIZE } from '../art/sprites/tiles';
import { drawFrame } from './Frame';

/** Tiles per minimap pixel. The valley is about 100 by 56 tiles. */
const SCALE = 0.62;

/**
 * A corner minimap, the kind Terraria and Core Keeper keep on screen: found
 * areas as blocks, the camp as a warm dot, you as a blinking one. It answers
 * "which way" without opening the full map, which is what a compass alone never
 * quite did.
 */
export class Minimap {
  readonly container: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.Graphics;
  private areas: Phaser.GameObjects.Graphics;
  private dots: Phaser.GameObjects.Graphics;
  private drawnFor = '';
  private ox: number;
  private oy: number;
  private w: number;
  private h: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const cols = Math.max(...AREA_LIST.map((a) => a.rect.x1));
    const rows = Math.max(...AREA_LIST.map((a) => a.rect.y1));
    this.w = Math.round(cols * SCALE) + 6;
    this.h = Math.round(rows * SCALE) + 6;
    this.ox = x + 3;
    this.oy = y + 3;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(7300);
    this.frame = scene.add.graphics();
    drawFrame(this.frame, x, y, this.w, this.h, { fill: PAL.black, alpha: 0.6 });
    this.areas = scene.add.graphics();
    this.dots = scene.add.graphics();
    this.container.add([this.frame, this.areas, this.dots]);
  }

  setVisible(on: boolean): void {
    this.container.setVisible(on);
  }

  update(playerX: number, playerY: number, time: number): void {
    if (!this.container.visible) return;
    const known = state.map.discoveredAreas;
    const signature = known.join(',');
    if (signature !== this.drawnFor) {
      this.drawnFor = signature;
      const g = this.areas;
      g.clear();
      for (const a of AREA_LIST) {
        const found = known.includes(a.id);
        if (a.hidden && !found) continue;
        g.fillStyle(hex(found ? a.tint : PAL.navy), found ? 0.7 : 0.5);
        g.fillRect(
          this.ox + a.rect.x0 * SCALE,
          this.oy + a.rect.y0 * SCALE,
          (a.rect.x1 - a.rect.x0) * SCALE,
          (a.rect.y1 - a.rect.y0) * SCALE,
        );
      }
    }

    const d = this.dots;
    d.clear();
    const cz = RETURN_ZONE;
    d.fillStyle(hex(PAL.orange), 1);
    d.fillRect(this.ox + ((cz.x0 + cz.x1) / 2) * SCALE - 1, this.oy + ((cz.y0 + cz.y1) / 2) * SCALE - 1, 3, 3);
    const blink = Math.floor(time / 300) % 2 === 0;
    d.fillStyle(hex(blink ? PAL.white : PAL.cyan), 1);
    d.fillRect(this.ox + (playerX / TILE_SIZE) * SCALE - 1, this.oy + (playerY / TILE_SIZE) * SCALE - 1, 3, 3);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
