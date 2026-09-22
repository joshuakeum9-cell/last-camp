import Phaser from 'phaser';
import { AREA_LIST, GATES, RETURN_ZONE, type AreaDef } from '../data/areas';
import { state } from '../core/GameState';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { BAL } from '../data/balance';
import { TILE_SIZE } from '../art/sprites/tiles';

/** Tiles per map pixel. The world is about 100 by 56 tiles; two pixels each fits. */
const SCALE = 2;

/**
 * The expedition map: every area found so far, drawn to scale, with the camp and the
 * player on it. Areas not yet walked into are dark shapes with no name, so the map
 * says where the edges of the known world are without spoiling what is past them.
 * Hidden areas are not drawn until found.
 */
export class WorldMap {
  readonly container: Phaser.GameObjects.Container;
  private areaShapes: Phaser.GameObjects.Graphics;
  private legend: Phaser.GameObjects.BitmapText;
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
    const legendW = 112;
    const pad = 8;
    const panelW = mapW + legendW + pad * 3;
    const panelH = mapH + pad * 2 + 12;
    const px = Math.round(width / 2 - panelW / 2);
    const py = Math.round(height / 2 - panelH / 2);
    this.ox = px + pad;
    this.oy = py + pad + 12;

    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(8000).setVisible(false);

    const shade = scene.add.rectangle(0, 0, width, height, hex(PAL.black)).setOrigin(0).setAlpha(0.55);
    const panel = scene.add
      .rectangle(px, py, panelW, panelH, hex(PAL.navy))
      .setOrigin(0)
      .setAlpha(0.96)
      .setStrokeStyle(1, hex(PAL.gold));
    const title = scene.add.bitmapText(px + pad, py + 3, FONT, 'THE VALLEY').setTint(hex(PAL.gold));
    const hint = scene.add
      .bitmapText(px + panelW - pad, py + 3, FONT, 'M closes')
      .setOrigin(1, 0)
      .setTint(hex(PAL.uiMuted));

    this.areaShapes = scene.add.graphics();
    this.legend = scene.add
      .bitmapText(this.ox + mapW + pad, this.oy, FONT, '')
      .setTint(hex(PAL.cream))
      .setLineSpacing(2);

    this.campDot = scene.add.rectangle(0, 0, 4, 4, hex(PAL.orange)).setOrigin(0.5);
    this.playerDot = scene.add.rectangle(0, 0, 4, 4, hex(PAL.white)).setOrigin(0.5);

    this.container.add([shade, panel, title, hint, this.areaShapes, this.legend, this.campDot, this.playerDot]);

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

  /** Called every frame while open, with the player's position in world pixels. */
  update(playerX: number, playerY: number): void {
    if (!this.container.visible) return;
    this.playerDot.setPosition(
      this.ox + (playerX / TILE_SIZE) * SCALE,
      this.oy + (playerY / TILE_SIZE) * SCALE,
    );
  }

  private redraw(): void {
    const known = state.map.discoveredAreas;
    const signature = known.join(',') + '|' + state.map.openedGates.length;
    if (signature === this.drawnFor) return;
    this.drawnFor = signature;

    const g = this.areaShapes;
    g.clear();

    const lines: string[] = [];
    let unknown = 0;

    const draw = (a: AreaDef, found: boolean) => {
      const x = this.ox + a.rect.x0 * SCALE;
      const y = this.oy + a.rect.y0 * SCALE;
      const w = (a.rect.x1 - a.rect.x0) * SCALE;
      const h = (a.rect.y1 - a.rect.y0) * SCALE;
      if (found) {
        g.fillStyle(hex(a.tint), 0.55);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, hex(a.tint), 1);
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      } else {
        g.fillStyle(hex(PAL.black), 0.5);
        g.fillRect(x, y, w, h);
        g.lineStyle(1, hex(PAL.greyDark), 0.8);
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }
    };

    for (const a of AREA_LIST) {
      const found = known.includes(a.id);
      if (a.hidden && !found) continue;
      draw(a, found);
      if (found) lines.push(a.name);
      else unknown++;
    }

    // Open gates are drawn as gaps in the drift, so the way through is on the map.
    for (const gate of Object.values(GATES)) {
      if (!state.map.openedGates.includes(gate.id)) continue;
      const x = this.ox + gate.rect.x0 * SCALE;
      const y = this.oy + gate.rect.y0 * SCALE;
      g.fillStyle(hex(PAL.gold), 0.9);
      g.fillRect(x, y, (gate.rect.x1 - gate.rect.x0) * SCALE, (gate.rect.y1 - gate.rect.y0) * SCALE);
    }

    if (unknown > 0) lines.push('', `${unknown} more unexplored`);
    this.legend.setText(lines.join('\n'));

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
