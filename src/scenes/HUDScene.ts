import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { hud } from '../core/HudState';
import { state } from '../core/GameState';
import { bus, Subscriptions } from '../core/EventBus';
import { Bar } from '../ui/Bar';
import { FONT } from '../art/PixelFont';
import { hex, PAL } from '../art/palette';
import { RESOURCES, RESOURCE_IDS, type ResourceId } from '../data/resources';
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
  private clock!: Phaser.GameObjects.BitmapText;
  private dayLabel!: Phaser.GameObjects.BitmapText;
  private clockArc!: Phaser.GameObjects.Graphics;
  private weaponLabel!: Phaser.GameObjects.BitmapText;
  private dashPips: Phaser.GameObjects.Rectangle[] = [];
  private comboLabel!: Phaser.GameObjects.BitmapText;
  private compass!: Phaser.GameObjects.Image;
  private resourceRows = new Map<ResourceId, {
    icon: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.BitmapText;
  }>();
  private toasts: Phaser.GameObjects.BitmapText[] = [];

  constructor() {
    super('HUD');
  }

  create(): void {
    const { width } = BAL.view;

    // --- health and cold, top left ---------------------------------------
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
    this.dayLabel = this.add
      .bitmapText(Math.round(width / 2), 5, FONT, 'DAY 1')
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.white))
      .setScrollFactor(0);
    this.clock = this.add
      .bitmapText(Math.round(width / 2), 15, FONT, 'MORNING')
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.cyan))
      .setScrollFactor(0);

    // --- weapon and dash, bottom right -----------------------------------
    this.weaponLabel = this.add
      .bitmapText(width - 6, BAL.view.height - 13, FONT, 'RUSTED AXE')
      .setOrigin(1, 0)
      .setTint(hex(PAL.steel))
      .setScrollFactor(0);

    for (let i = 0; i < 1; i++) {
      const pip = this.add
        .rectangle(width - 6 - i * 10, BAL.view.height - 20, 8, 3, hex(PAL.cyan))
        .setOrigin(1, 0)
        .setScrollFactor(0);
      this.dashPips.push(pip);
    }

    this.comboLabel = this.add
      .bitmapText(Math.round(width / 2), 30, FONT, '')
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.gold))
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
    RESOURCE_IDS.forEach((id, i) => {
      const y = 6 + i * 9;
      const icon = this.add
        .rectangle(width - 8, y + 1, 5, 5, hex(RESOURCES[id].color))
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setVisible(false);
      const label = this.add
        .bitmapText(width - 16, y, FONT, '0')
        .setOrigin(1, 0)
        .setTint(hex(PAL.white))
        .setScrollFactor(0)
        .setVisible(false);
      this.resourceRows.set(id, { icon, label });
    });
  }

  private toast(text: string, color: string = PAL.cream): void {
    const { width, height } = BAL.view;
    const label = this.add
      .bitmapText(Math.round(width / 2), height - 34, FONT, text)
      .setOrigin(0.5, 0)
      .setTint(hex(color))
      .setScrollFactor(0)
      .setDepth(100);

    for (const t of this.toasts) t.y -= 11;
    this.toasts.push(label);

    this.tweens.add({
      targets: label,
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
      this.clock.setTint(hex(urgent ? PAL.gold : PAL.cyan));
      this.drawClockArc(width);
    }

    this.weaponLabel.setText(hud.weaponName).setTint(hex(hud.weaponColor));
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
      const y = 6 + row * 9;
      entry.icon.y = y + 1;
      entry.label.y = y;
      entry.label.setText(String(amount));
      row++;
    }
  }
}
