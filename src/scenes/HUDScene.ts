import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { hud } from '../core/HudState';
import { state } from '../core/GameState';
import { bus, Subscriptions } from '../core/EventBus';
import { Bar } from '../ui/Bar';
import { FONT } from '../art/PixelFont';
import { Label } from '../ui/Label';
import { hex, PAL } from '../art/palette';
import { RESOURCE_IDS, type ResourceId } from '../data/resources';
import { RESOURCE_ICON } from '../art/sprites/icons';
import { FX } from '../art/sprites/fx';

/**
 * The overlay. During an expedition it shows only what the player must act on:
 * health, cold, the time of day, the weapon, and what they are carrying.
 */
export class HUDScene extends Phaser.Scene {
  private subs = new Subscriptions();

  private hpBar!: Bar;
  private coldBar!: Bar;
  private coldIcon!: Phaser.GameObjects.BitmapText;
  private clock!: Label;
  private dayLabel!: Label;
  private clockArc!: Phaser.GameObjects.Graphics;
  private weaponLabel!: Label;
  private dashPips: Phaser.GameObjects.Rectangle[] = [];
  private comboLabel!: Label;
  private compass!: Phaser.GameObjects.Image;
  private resourceRows = new Map<ResourceId, { icon: Phaser.GameObjects.Image; label: Label }>();
  private toasts: Label[] = [];
  private resourcePanel!: Phaser.GameObjects.Rectangle;
  private statusPanel!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('HUD');
  }

  create(): void {
    const { width } = BAL.view;

    // --- health and cold, top left ---------------------------------------
    // The same treatment for the health and cold meters on the left.
    this.statusPanel = this.add
      .rectangle(2, 2, 84, 22, hex(PAL.black))
      .setOrigin(0)
      .setAlpha(0.42)
      .setStrokeStyle(1, hex(PAL.blueDark), 0.7)
      .setScrollFactor(0);

    this.hpBar = new Bar(this, 6, 6, {
      width: 74,
      height: 7,
      fill: PAL.blood,
      ghost: PAL.cream,
    }).setScrollFactor(0);

    this.coldBar = new Bar(this, 6, 16, {
      width: 58,
      height: 5,
      fill: PAL.ice,
    }).setScrollFactor(0);

    this.coldIcon = this.add
      .bitmapText(68, 15, FONT, '*')
      .setTint(hex(PAL.cyan))
      .setScrollFactor(0);

    // --- day clock, top centre -------------------------------------------
    this.clockArc = this.add.graphics().setScrollFactor(0);
    this.dayLabel = new Label(this, Math.round(width / 2), 5, 'DAY 1', {
      color: PAL.white,
      originX: 0.5,
    }).setScrollFactor(0);
    this.clock = new Label(this, Math.round(width / 2), 15, 'MORNING', {
      color: PAL.cyan,
      originX: 0.5,
    }).setScrollFactor(0);

    // --- weapon and dash, bottom right -----------------------------------
    this.weaponLabel = new Label(this, width - 6, BAL.view.height - 13, 'RUSTED AXE', {
      color: PAL.steel,
      originX: 1,
    }).setScrollFactor(0);

    for (let i = 0; i < 1; i++) {
      const pip = this.add
        .rectangle(width - 6 - i * 10, BAL.view.height - 20, 8, 3, hex(PAL.cyan))
        .setOrigin(1, 0)
        .setScrollFactor(0);
      this.dashPips.push(pip);
    }

    this.comboLabel = new Label(this, Math.round(width / 2), 30, '', {
      color: PAL.gold,
      originX: 0.5,
    })
      .setScrollFactor(0)
      .setVisible(false);

    this.compass = this.add
      .image(width - 20, 28, FX.dot3)
      .setTint(hex(PAL.orange))
      .setScrollFactor(0)
      .setVisible(false);

    this.buildResourceRows();

    this.subs.add(bus.on('juice:toast', ({ text, color }) => this.toast(text, color)));
    this.events.once('shutdown', () => this.subs.dispose());
  }

  private buildResourceRows(): void {
    const { width } = BAL.view;

    // The counters sit over open snow, where a bare number disappears. A panel is
    // cheaper and steadier to read than outlining every digit.
    this.resourcePanel = this.add
      .rectangle(width - 2, 2, 46, 10, hex(PAL.black))
      .setOrigin(1, 0)
      .setAlpha(0.42)
      .setStrokeStyle(1, hex(PAL.blueDark), 0.7)
      .setScrollFactor(0);

    RESOURCE_IDS.forEach((id, i) => {
      const y = 6 + i * 11;
      const icon = this.add
        .image(width - 6, y, RESOURCE_ICON[id])
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setVisible(false);
      const label = new Label(this, width - 18, y + 1, '0', { color: PAL.white, originX: 1 })
        .setScrollFactor(0)
        .setVisible(false);
      this.resourceRows.set(id, { icon, label });
    });
  }

  private toast(text: string, color: string = PAL.cream): void {
    const { width, height } = BAL.view;
    const label = new Label(this, Math.round(width / 2), height - 34, text, {
      color,
      originX: 0.5,
    })
      .setScrollFactor(0)
      .setDepth(100);

    for (const t of this.toasts) t.y -= 11;
    this.toasts.push(label);

    this.tweens.add({
      targets: label.target,
      alpha: 0,
      delay: 1700,
      duration: 400,
      onComplete: () => {
        this.toasts = this.toasts.filter((t) => t !== label);
        label.destroy();
      },
    });
  }

  update(_time: number, delta: number): void {
    const { width } = BAL.view;
    const inWorld = hud.context === 'world';

    this.hpBar.set(hud.hp / Math.max(1, hud.maxHp));
    this.hpBar.update(delta);
    this.hpBar.setFillColor(hud.hp / hud.maxHp < 0.3 ? PAL.ember : PAL.blood);

    this.coldBar.setVisible(inWorld).set(hud.cold / hud.maxCold);
    this.coldIcon.setVisible(inWorld);
    if (inWorld && hud.cold >= BAL.cold.warnAt) {
      // The icon shivers, so the warning does not depend on the bar's colour alone.
      this.coldIcon.x = 68 + Phaser.Math.Between(-1, 1);
      this.coldIcon.setTint(hex(PAL.white));
    } else {
      this.coldIcon.x = 68;
      this.coldIcon.setTint(hex(PAL.cyan));
    }

    this.dayLabel.setText(`DAY ${hud.day}`);
    this.clock.setVisible(inWorld);
    this.clockArc.setVisible(inWorld);
    if (inWorld) {
      const text = hud.showSeconds
        ? `${hud.phaseName}  ${Math.max(0, Math.ceil(hud.secondsLeft))}s`
        : hud.phaseName;
      this.clock.setText(text);
      const urgent = hud.phaseName === 'NIGHTFALL' || hud.phaseName === 'NIGHT';
      this.clock.setTint(urgent ? PAL.gold : PAL.cyan);
      this.drawClockArc(width);
    }

    this.weaponLabel.setText(hud.weaponName).setTint(hud.weaponColor);
    for (const pip of this.dashPips) {
      pip.setFillStyle(hex(hud.dashCharge >= 1 ? PAL.cyan : PAL.greyDark));
      pip.scaleX = hud.dashCharge >= 1 ? 1 : Math.max(0.08, hud.dashCharge);
    }

    this.comboLabel.setVisible(hud.comboCount >= 3);
    if (hud.comboCount >= 3) this.comboLabel.setText(`x${hud.comboCount}`);

    this.compass.setVisible(inWorld && hud.homeAngle !== null);
    if (hud.homeAngle !== null) {
      this.compass.setPosition(
        width - 20 + Math.cos(hud.homeAngle) * 9,
        28 + Math.sin(hud.homeAngle) * 9,
      );
    }

    this.updateResources();
  }

  private drawClockArc(width: number): void {
    const g = this.clockArc;
    g.clear();
    const cx = Math.round(width / 2);
    const cy = 4;
    const r = 24;
    g.lineStyle(1, hex(PAL.greyDark), 0.9);
    g.beginPath();
    g.arc(cx, cy, r, Math.PI, Math.PI * 2);
    g.strokePath();

    const angle = Math.PI + Math.PI * Phaser.Math.Clamp(hud.dayProgress, 0, 1);
    const night = hud.dayProgress >= 0.83;
    g.fillStyle(hex(night ? PAL.ice : PAL.gold), 1);
    g.fillCircle(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 2);
  }

  private updateResources(): void {
    const bag = hud.context === 'world' ? hud.carried : state.camp.storage;
    let row = 0;
    for (const id of RESOURCE_IDS) {
      const entry = this.resourceRows.get(id);
      if (!entry) continue;
      const amount = bag[id] ?? 0;
      const show = amount > 0;
      entry.icon.setVisible(show);
      entry.label.setVisible(show);
      if (!show) continue;
      const y = 6 + row * 11;
      entry.icon.y = y;
      entry.label.y = y + 1;
      entry.label.setText(String(amount));
      row++;
    }

    this.resourcePanel.setVisible(row > 0);
    if (row > 0) this.resourcePanel.height = 4 + row * 11;
    this.statusPanel.height = hud.context === 'world' ? 22 : 13;
  }
}
