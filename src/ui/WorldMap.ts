import Phaser from 'phaser';
import { AREA_LIST, GATES, RETURN_ZONE, type AreaDef } from '../data/areas';
import { state } from '../core/GameState';
import { FONT, textWidth } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { BAL } from '../data/balance';
import { TILE_SIZE } from '../art/sprites/tiles';
import { drawFrame } from './Frame';

/** Tiles per map pixel. The world is 98 by 54 tiles, so three pixels each still fits. */
const SCALE = 3;

/** What the coloured squares on the map mean. */
const KEY: Array<{ color: string; text: string }> = [
  { color: PAL.white, text: 'You' },
  { color: PAL.orange, text: 'Camp' },
  { color: PAL.cyan, text: 'The sighting' },
  { color: PAL.gold, text: 'Supply drop' },
  { color: PAL.cream, text: 'Your pack' },
];

/**
 * The expedition map: every area found so far, drawn to scale and named on the map
 * itself, with the camp, the player and whatever is worth walking to today.
 *
 * A map of unlabelled coloured boxes with the names in a list beside it makes the
 * player do the matching. Every map worth copying, from Don't Starve to Terraria,
 * writes the name of the place on the place. Areas not yet walked into stay dark
 * with a question mark, so the map says where the known world ends without saying
 * what is past it, and the ways through that are still blocked are marked too.
 */
export class WorldMap {
  readonly container: Phaser.GameObjects.Container;
  private areaShapes: Phaser.GameObjects.Graphics;
  private legend: Phaser.GameObjects.BitmapText;
  private names: Phaser.GameObjects.BitmapText[] = [];
  private playerDot: Phaser.GameObjects.Rectangle;
  private campDot: Phaser.GameObjects.Rectangle;
  private ox = 0;
  private oy = 0;
  private drawnFor = '';

  constructor(private scene: Phaser.Scene) {
    const { width, height } = BAL.view;
    const cols = Math.max(...AREA_LIST.map((a) => a.rect.x1));
    const rows = Math.max(...AREA_LIST.map((a) => a.rect.y1));
    const mapW = cols * SCALE;
    const mapH = rows * SCALE;
    const legendW = 108;
    const pad = 7;
    const panelW = mapW + legendW + pad * 3;
    const panelH = mapH + pad * 2 + 12;
    const px = Math.round(width / 2 - panelW / 2);
    const py = Math.round(height / 2 - panelH / 2);
    this.ox = px + pad;
    this.oy = py + pad + 12;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(8000).setVisible(false);

    const shade = scene.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0).setAlpha(0.55);
    const panel = scene.add.graphics();
    drawFrame(panel, px, py, panelW, panelH, { edge: PAL.gold, alpha: 0.96 });
    const title = scene.add.bitmapText(px + pad, py + 3, FONT, 'THE VALLEY').setTint(hex(PAL.gold));
    const hint = scene.add
      .bitmapText(px + panelW - pad - 2, py + panelH - 11, FONT, 'M closes')
      .setOrigin(1, 0)
      .setTint(hex(PAL.uiMuted));

    this.areaShapes = scene.add.graphics();
    this.legend = scene.add
      .bitmapText(this.ox + mapW + pad + 9, this.oy + 1, FONT, '')
      .setTint(hex(PAL.cream))
      .setLineSpacing(3);

    this.campDot = scene.add.rectangle(0, 0, 4, 4, hex(PAL.orange)).setOrigin(0.5);
    this.playerDot = scene.add.rectangle(0, 0, 4, 4, hex(PAL.white)).setOrigin(0.5);

    this.container.add([shade, panel, title, hint, this.areaShapes, this.legend, this.campDot, this.playerDot]);

    // The key's own colour swatches, drawn once beside the lines they belong to.
    const swatches = scene.add.graphics();
    KEY.forEach((k, i) => {
      swatches.fillStyle(hex(k.color), 1);
      swatches.fillRect(this.ox + mapW + pad, this.oy + 2 + i * 12, 5, 5);
    });
    this.container.add(swatches);

    scene.tweens.add({
      targets: this.playerDot,
      alpha: 0.3,
      duration: 420,
      yoyo: true,
      repeat: -1,
    });
  }

  get visible(): boolean {
    return this.container.visible;
  }

  toggle(): void {
    if (this.container.visible) this.hide();
    else this.show();
  }

  show(): void {
    this.redraw();
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  private markDots?: Phaser.GameObjects.Graphics;

  /** Called every frame while open, with the player's position in world pixels. */
  update(playerX: number, playerY: number, marks: Array<{ x: number; y: number; color: string }> = []): void {
    if (!this.container.visible) return;
    if (!this.markDots) {
      this.markDots = this.scene.add.graphics();
      this.container.addAt(this.markDots, this.container.list.indexOf(this.campDot));
    }
    const g = this.markDots;
    g.clear();
    for (const m of marks) {
      g.fillStyle(hex(m.color), 1);
      g.fillRect(this.ox + (m.x / TILE_SIZE) * SCALE - 2, this.oy + (m.y / TILE_SIZE) * SCALE - 2, 4, 4);
    }
    this.playerDot.setPosition(
      this.ox + (playerX / TILE_SIZE) * SCALE,
      this.oy + (playerY / TILE_SIZE) * SCALE,
    );
  }

  /**
   * Is this band of the map clear of every other area's box? The camp gate sits
   * inside the forest, so the forest's name has to move off it rather than
   * straddle two boxes and belong to neither.
   */
  private clearBand(self: AreaDef, cy: number, half: number): boolean {
    for (const other of AREA_LIST) {
      if (other.id === self.id) continue;
      if (!state.map.discoveredAreas.includes(other.id)) continue;
      const oy0 = this.oy + other.rect.y0 * SCALE;
      const oy1 = this.oy + other.rect.y1 * SCALE;
      const ox0 = this.ox + other.rect.x0 * SCALE;
      const ox1 = this.ox + other.rect.x1 * SCALE;
      const sx0 = this.ox + self.rect.x0 * SCALE;
      const sx1 = this.ox + self.rect.x1 * SCALE;
      const overlapsX = ox1 > sx0 && ox0 < sx1;
      if (overlapsX && oy1 > cy - half && oy0 < cy + half) return false;
    }
    return true;
  }

  /** The name written on the place, split over two lines when one will not fit. */
  private label(a: AreaDef, x: number, y: number, w: number, h: number): void {
    const name = a.name.toUpperCase().replace(/^THE /, '');
    const words = name.split(' ');
    const fits = (s: string) => textWidth(s) <= w - 6;

    let lines: string[] = [];
    if (fits(name)) lines = [name];
    else if (words.length > 1) {
      // Two lines: as many words on the first as fit, the rest on the second.
      for (let split = words.length - 1; split >= 1; split--) {
        const first = words.slice(0, split).join(' ');
        const second = words.slice(split).join(' ');
        if (fits(first) && fits(second)) {
          lines = [first, second];
          break;
        }
      }
    }
    if (!lines.length || lines.length * 9 > h - 4) return;

    // The middle of the area, or the nearest band above or below it that no
    // other area's box is sitting in.
    const half = (lines.length * 9) / 2 + 2;
    const middle = y + h / 2;
    let cy = middle;
    for (const candidate of [middle, y + h * 0.25, y + h * 0.75, y + h * 0.12, y + h * 0.88]) {
      if (candidate - half < y + 2 || candidate + half > y + h - 2) continue;
      if (this.clearBand(a, candidate, half)) {
        cy = candidate;
        break;
      }
    }

    lines.forEach((line, i) => {
      this.names.push(
        this.scene.add
          .bitmapText(Math.round(x + w / 2), Math.round(cy - (lines.length * 9) / 2 + i * 9), FONT, line)
          .setOrigin(0.5, 0)
          .setTint(hex(PAL.cream))
          .setAlpha(0.85),
      );
    });
  }

  private redraw(): void {
    // The map is torn down with the day. A tap that lands in that gap must do
    // nothing rather than draw into a dead scene.
    if (!this.legend.scene) return;
    const known = state.map.discoveredAreas;
    const signature = known.join(',') + '|' + state.map.openedGates.join(',');
    if (signature === this.drawnFor) return;
    this.drawnFor = signature;

    const g = this.areaShapes;
    g.clear();
    for (const n of this.names) n.destroy();
    this.names = [];

    let unknown = 0;

    for (const a of AREA_LIST) {
      const found = known.includes(a.id);
      if (a.hidden && !found) continue;
      const x = this.ox + a.rect.x0 * SCALE;
      const y = this.oy + a.rect.y0 * SCALE;
      const w = (a.rect.x1 - a.rect.x0) * SCALE;
      const h = (a.rect.y1 - a.rect.y0) * SCALE;

      if (found) {
        g.fillStyle(hex(a.tint), 0.55);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, hex(a.tint), 1);
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        this.label(a, x, y, w, h);
      } else {
        unknown++;
        g.fillStyle(hex(PAL.black), 0.5);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, hex(PAL.greyDark), 0.8);
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        if (w > 10 && h > 12) {
          this.names.push(
            this.scene.add
              .bitmapText(Math.round(x + w / 2), Math.round(y + h / 2 - 4), FONT, '?')
              .setOrigin(0.5, 0)
              .setTint(hex(PAL.greyDark)),
          );
        }
      }
    }

    // Every way through that has a gate in it: gold once it is open, red while it
    // is not, so the map shows where the valley is still shut.
    for (const gate of Object.values(GATES)) {
      if (gate.hidden && !state.map.openedGates.includes(gate.id)) continue;
      const open = state.map.openedGates.includes(gate.id);
      const x = this.ox + gate.rect.x0 * SCALE;
      const y = this.oy + gate.rect.y0 * SCALE;
      g.fillStyle(hex(open ? PAL.gold : PAL.blood), open ? 0.9 : 0.75);
      g.fillRect(x, y, (gate.rect.x1 - gate.rect.x0) * SCALE, (gate.rect.y1 - gate.rect.y0) * SCALE);
    }

    const lines = KEY.map((k) => k.text);
    lines.push('', unknown > 0 ? `${unknown} more unexplored` : 'All of it walked');
    const shut = Object.values(GATES).filter(
      (gate) => !state.map.openedGates.includes(gate.id) && !gate.hidden,
    ).length;
    if (shut > 0) lines.push(`${shut} way${shut > 1 ? 's' : ''} still shut`);
    this.legend.setText(lines.join('\n'));
    for (const n of this.names) this.container.add(n);

    const cz = RETURN_ZONE;
    this.campDot.setPosition(
      this.ox + ((cz.x0 + cz.x1) / 2) * SCALE,
      this.oy + ((cz.y0 + cz.y1) / 2) * SCALE,
    );
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
