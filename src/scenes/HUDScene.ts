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
import { WEAPON_ICON_KEY } from '../art/sprites/weapons';
import { ResourceSystem } from '../systems/ResourceSystem';
import { FX } from '../art/sprites/fx';
import { touchControlsWanted } from '../ui/TouchControls';

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
  private hotbar: Array<{
    frame: Phaser.GameObjects.Rectangle;
    icon: Phaser.GameObjects.Image;
    count: Label;
    key: Phaser.GameObjects.BitmapText;
  }> = [];
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

    // The HUD is stopped at the end of every day and launched again at camp. Scene
    // fields survive that, so anything collected here must start empty or the update
    // keeps driving game objects the previous run destroyed.
    this.hotbar = [];
    this.dashPips = [];
    this.toasts = [];
    this.resourceRows.clear();

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
    // The weapon's name sits just above its slot, so the icon never has to be
    // guessed at. The hotbar moves it if the bar is not in the corner.
    this.weaponLabel = new Label(this, width - 6, BAL.view.height - 38, 'RUSTED AXE', {
      color: PAL.steel,
      originX: 1,
    }).setScrollFactor(0);
    this.buildHotbar();

    const pip = this.add
      .rectangle(width - 6, BAL.view.height - 43, 8, 3, hex(PAL.cyan))
      .setOrigin(1, 0)
      .setScrollFactor(0);
    this.dashPips.push(pip);

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
    this.subs.add(
      bus.on('settings:changed', ({ key }) => {
        if (key === 'showTouch') this.scene.restart();
      }),
    );
    this.events.once('shutdown', () => this.subs.dispose());
  }

  /**
   * Three slots, bottom right: primary weapon, second weapon, food. The kind of bar
   * every survival game has taught players to look for. The active weapon's frame is
   * gold; a slot you cannot use yet is dimmed rather than hidden.
   */
  private buildHotbar(): void {
    const { width, height } = BAL.view;
    const size = 22;
    const gap = 3;
    const count = 3;
    const totalW = count * size + (count - 1) * gap;
    // With on-screen buttons in the bottom right corner, the bar sits bottom centre
    // instead, between the stick and the buttons, where a thumb can still reach it.
    const touch = touchControlsWanted(this);
    const x0 = touch ? Math.round(width / 2 - totalW / 2) : width - 4 - totalW;
    const y = height - 4 - size;
    this.weaponLabel.container.x = touch ? x0 + totalW : width - 6;

    this.add
      .rectangle(x0 - 3, y - 3, totalW + 6, size + 6, hex(PAL.black))
      .setOrigin(0)
      .setAlpha(0.55)
      .setStrokeStyle(1, hex(PAL.blueDark), 0.7)
      .setScrollFactor(0);

    const keys = ['1', '2', 'F'];
    for (let i = 0; i < count; i++) {
      const x = x0 + i * (size + gap);
      const frame = this.add
        .rectangle(x, y, size, size, hex(PAL.navy))
        .setOrigin(0)
        .setAlpha(0.9)
        .setStrokeStyle(1, hex(PAL.greyDark))
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      // Tapping a slot is the same as pressing its key. The event stops here so the
      // scene underneath does not also read the tap as an attack.
      const slot = i;
      frame.on('pointerdown', () => {
        this.input.stopPropagation();
        bus.emit('hud:slot', { slot });
      });
      const icon = this.add
        .image(x + size / 2, y + size / 2, 'fx-dot1')
        .setScale(1.6)
        .setScrollFactor(0)
        .setVisible(false);
      const countLabel = new Label(this, x + size - 2, y + size - 9, '', {
        color: PAL.white,
        outline: 'shadow',
        originX: 1,
      }).setScrollFactor(0);
      const key = this.add
        .bitmapText(x + 2, y + 1, FONT, keys[i])
        .setTint(hex(PAL.uiMuted))
        .setScrollFactor(0);
      this.hotbar.push({ frame, icon, count: countLabel, key });
    }
  }

  private updateHotbar(): void {
    const [primary, secondary, food] = this.hotbar;
    const equipped = state.player.equipped;
    const find = (uid: string | null) => state.player.weapons.find((w) => w.uid === uid);

    const active = state.player.activeSlot ?? 0;
    const hasRack = ResourceSystem.campEffects().weaponSlots > 1;

    const w1 = find(equipped[0]);
    primary.icon.setVisible(!!w1);
    if (w1) primary.icon.setTexture(WEAPON_ICON_KEY[w1.base] ?? 'fx-dot1').setScale(1.6).setAlpha(1);
    primary.frame.setStrokeStyle(1, hex(active === 0 ? PAL.gold : PAL.greyDark)).setAlpha(0.9);
    primary.count.setText('');

    const w2 = find(equipped[1]);
    secondary.icon.setVisible(!!w2);
    if (w2) secondary.icon.setTexture(WEAPON_ICON_KEY[w2.base] ?? 'fx-dot1').setScale(1.6).setAlpha(1);
    secondary.frame
      .setStrokeStyle(1, hex(active === 1 ? PAL.gold : PAL.greyDark))
      .setAlpha(hasRack ? 0.9 : 0.45);
    secondary.count.setText('');

    const foodCount = hud.context === 'world' ? (hud.carried.food ?? 0) : (state.camp.storage.food ?? 0);
    food.icon.setVisible(true).setTexture(RESOURCE_ICON.food).setScale(1.5).setAlpha(foodCount > 0 ? 1 : 0.35);
    food.count.setText(foodCount > 0 ? String(Math.min(99, foodCount)) : '');
    food.frame.setStrokeStyle(1, hex(foodCount > 0 ? PAL.green : PAL.greyDark));
  }

  private buildResourceRows(): void {
    const { height } = BAL.view;
    const y = height - 15;
    const slot = 42;

    // A permanent strip along the bottom left. Every resource is always shown, even at
    // zero, so a new player can see what the game counts before they have any of it.
    this.resourcePanel = this.add
      .rectangle(2, y - 3, RESOURCE_IDS.length * slot + 6, 16, hex(PAL.black))
      .setOrigin(0)
      .setAlpha(0.55)
      .setStrokeStyle(1, hex(PAL.blueDark), 0.7)
      .setScrollFactor(0);

    RESOURCE_IDS.forEach((id, i) => {
      const x = 6 + i * slot;
      const icon = this.add.image(x, y - 1, RESOURCE_ICON[id]).setOrigin(0).setScrollFactor(0);
      const label = new Label(this, x + 13, y, '0', { color: PAL.white, outline: 'shadow' })
        .setScrollFactor(0);
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

    // Cold is shown at camp too now, because it drains off at the fire and the
    // player should be able to watch that happen.
    this.coldBar.setVisible(true).set(hud.cold / hud.maxCold);
    this.coldIcon.setVisible(true);
    if (hud.cold >= BAL.cold.warnAt) {
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
    this.updateHotbar();
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
    // Out in the world this is what you are carrying; at camp it is what is stored.
    const bag = hud.context === 'world' ? hud.carried : state.camp.storage;
    for (const id of RESOURCE_IDS) {
      const entry = this.resourceRows.get(id);
      if (!entry) continue;
      const amount = bag[id] ?? 0;
      entry.label.setText(String(amount));
      // Empty slots are dimmed rather than hidden, so the row never changes shape.
      entry.icon.setAlpha(amount > 0 ? 1 : 0.35);
      entry.label.setAlpha(amount > 0 ? 1 : 0.4);
    }
    this.statusPanel.height = 22;
  }
}
