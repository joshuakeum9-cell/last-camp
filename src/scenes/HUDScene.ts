import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { hud } from '../core/HudState';
import { state } from '../core/GameState';
import { bus, Subscriptions } from '../core/EventBus';
import { Bar } from '../ui/Bar';
import { FONT } from '../art/PixelFont';
import { Label } from '../ui/Label';
import { hex, PAL, RARITY_COLOR } from '../art/palette';
import { RESOURCE_IDS, type ResourceId } from '../data/resources';
import { RESOURCE_ICON } from '../art/sprites/icons';
import { WEAPON_ICON_KEY } from '../art/sprites/weapons';
import { ResourceSystem } from '../systems/ResourceSystem';
import { FX } from '../art/sprites/fx';
import { touchControlsWanted } from '../ui/TouchControls';
import { makeFrame, drawFrame } from '../ui/Frame';
import { PixelFactory } from '../art/PixelFactory';
import { Minimap } from '../ui/Minimap';
import { nextObjective } from '../data/objectives';

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
    ring: Phaser.GameObjects.Rectangle;
    frame: Phaser.GameObjects.Rectangle;
    icon: Phaser.GameObjects.Image;
    count: Label;
    key: Phaser.GameObjects.BitmapText;
  }> = [];
  private comboLabel!: Label;
  private compass!: Phaser.GameObjects.Image;
  private resourceRows = new Map<ResourceId, { icon: Phaser.GameObjects.Image; label: Label }>();
  private toasts: Label[] = [];
  private resourcePanel!: Phaser.GameObjects.Graphics;
  private statusPanel!: Phaser.GameObjects.Graphics;
  private hpText!: Label;
  private coldText!: Label;
  private dialBack!: Phaser.GameObjects.Graphics;
  private pauseButton!: Phaser.GameObjects.Rectangle;
  private compassHit!: Phaser.GameObjects.Rectangle;
  private pauseGlyph!: Phaser.GameObjects.BitmapText;
  private bossBack!: Phaser.GameObjects.Rectangle;
  private bossFill!: Phaser.GameObjects.Rectangle;
  private bossLabel!: Label;
  private minimap!: Minimap;
  private objective!: Label;
  private objectiveTag!: Phaser.GameObjects.BitmapText;
  private hurtWash!: Phaser.GameObjects.Image;
  private eventLabel!: Label;
  private savedLabel!: Phaser.GameObjects.BitmapText;

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
    // A heart and a snowflake, a bar each, and the number inside the bar. The
    // number is the part players actually read once they know the game.
    if (!this.textures.exists('ui-heart')) {
      PixelFactory.makeTexture(
        this,
        'ui-heart',
        ['.ww.ww.', 'wwwwwww', 'wwwwwww', '.wwwww.', '..www..', '...w...'],
        { '.': null, w: 'blood' },
      );
    }
    this.statusPanel = makeFrame(this, 2, 2, 104, 28, { fill: PAL.black, alpha: 0.5 }).setScrollFactor(0);

    this.add.image(8, 10, 'ui-heart').setOrigin(0, 0.5).setScrollFactor(0);
    this.hpBar = new Bar(this, 18, 5, {
      width: 82,
      height: 10,
      fill: PAL.blood,
      ghost: PAL.cream,
    }).setScrollFactor(0);
    this.hpText = new Label(this, 59, 6, '60/60', { color: PAL.white, originX: 0.5, outline: 'shadow' })
      .setScrollFactor(0);

    this.coldIcon = this.add
      .bitmapText(8, 17, FONT, '*')
      .setTint(hex(PAL.cyan))
      .setScrollFactor(0);
    this.coldBar = new Bar(this, 18, 19, {
      width: 60,
      height: 6,
      fill: PAL.ice,
    }).setScrollFactor(0);
    this.coldText = new Label(this, 100, 17, '0', { color: PAL.cyan, originX: 1, outline: 'shadow' })
      .setScrollFactor(0);

    // --- day dial, top centre --------------------------------------------
    // A clock face split into the day's phases, with the day number in the middle
    // and the hand sweeping round it. One glance says how much light is left.
    this.dialBack = this.add.graphics().setScrollFactor(0);
    this.clockArc = this.add.graphics().setScrollFactor(0);
    this.dayLabel = new Label(this, Math.round(width / 2), 13, '1', {
      color: PAL.white,
      originX: 0.5,
      outline: 'shadow',
    }).setScrollFactor(0);
    this.clock = new Label(this, Math.round(width / 2), 33, 'MORNING', {
      color: PAL.cyan,
      originX: 0.5,
    }).setScrollFactor(0);
    // The day's event, beside the dial, so a wolf moon is on screen all day.
    this.eventLabel = new Label(this, Math.round(width / 2) + 20, 8, '', { color: PAL.gold, outline: 'shadow' })
      .setScrollFactor(0);

    // --- boss bar, top centre, only in a fight ----------------------------
    const bossW = 160;
    this.bossBack = this.add
      .rectangle(Math.round(width / 2), 46, bossW, 5, hex(PAL.black))
      .setOrigin(0.5, 0)
      .setAlpha(0.7)
      .setStrokeStyle(1, hex(PAL.blood), 0.9)
      .setScrollFactor(0)
      .setVisible(false);
    this.bossFill = this.add
      .rectangle(Math.round(width / 2 - bossW / 2), 46, bossW, 5, hex(PAL.blood))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setVisible(false);
    this.bossLabel = new Label(this, Math.round(width / 2), 52, '', { color: PAL.blood, originX: 0.5 })
      .setScrollFactor(0)
      .setVisible(false);

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

    // A generous invisible hit area round the compass: tapping it opens the map.
    this.compassHit = this.add
      .rectangle(width - 86, 30, 28, 28, hex(PAL.black))
      .setAlpha(0.001)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.compassHit.on('pointerdown', () => {
      this.input.stopPropagation();
      bus.emit('hud:map', {});
    });
    this.compass = this.add
      .image(width - 86, 30, FX.dot3)
      .setTint(hex(PAL.orange))
      .setScrollFactor(0)
      .setVisible(false);

    // Pause, top right corner. Small, because the keyboard has ESC, but always
    // there for a thumb.
    this.pauseButton = this.add
      .rectangle(width - 4, 4, 14, 12, hex(PAL.black))
      .setOrigin(1, 0)
      .setAlpha(0.6)
      .setStrokeStyle(1, hex(PAL.blueDark), 0.9)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.pauseGlyph = this.add
      .bitmapText(width - 11, 6, FONT, 'II')
      .setOrigin(0.5, 0)
      .setTint(hex(PAL.grey))
      .setScrollFactor(0);
    this.pauseButton.on('pointerdown', () => {
      this.input.stopPropagation();
      bus.emit('hud:pause', {});
    });

    // A red wash that breathes when health is low. It is the warning every game
    // in this space gives, and the one players say they miss most when it is gone.
    if (!this.textures.exists('ui-vignette')) {
      // Clear in the middle, red at the edges: a proper vignette, drawn once.
      const vw = 240;
      const vh = 135;
      const tex = this.textures.createCanvas('ui-vignette', vw, vh);
      if (tex) {
        const ctx = tex.getContext();
        const grad = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.35, vw / 2, vh / 2, vw * 0.62);
        grad.addColorStop(0, 'rgba(255,43,85,0)');
        grad.addColorStop(1, 'rgba(255,43,85,1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, vw, vh);
        tex.refresh();
      }
    }
    this.hurtWash = this.add
      .image(Math.round(width / 2), Math.round(BAL.view.height / 2), 'ui-vignette')
      .setScale(2)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(-1);

    // A small SAVED that blinks whenever the save is written. Phones especially:
    // people close the tab and want to know it kept.
    this.savedLabel = this.add
      .bitmapText(width - 6, BAL.view.height - 60, FONT, 'SAVED')
      .setOrigin(1, 0)
      .setTint(hex(PAL.green))
      .setAlpha(0)
      .setScrollFactor(0);
    this.subs.add(
      bus.on('save:done', () => {
        this.tweens.killTweensOf(this.savedLabel);
        this.savedLabel.setAlpha(1);
        this.tweens.add({ targets: this.savedLabel, alpha: 0, delay: 700, duration: 500 });
      }),
    );

    // The one line that says what to do next. Under the meters, where the eye
    // already goes; gold tag, plain words.
    this.objectiveTag = this.add
      .bitmapText(6, 34, FONT, 'NEXT')
      .setTint(hex(PAL.gold))
      .setScrollFactor(0);
    this.objective = new Label(this, 32, 34, '', { color: PAL.cream, outline: 'shadow' }).setScrollFactor(0);

    // Minimap, top right under the pause button, world only.
    this.minimap = new Minimap(this, width - 72, 18);

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

    makeFrame(this, x0 - 4, y - 4, totalW + 8, size + 8, { fill: PAL.black, alpha: 0.6 }).setScrollFactor(0);

    const keys = ['1', '2', 'F'];
    for (let i = 0; i < count; i++) {
      const x = x0 + i * (size + gap);
      // A gold ring round the active slot, outside the frame, so the frame itself
      // can carry the weapon's rarity colour the way Diablo's slots do.
      const ring = this.add
        .rectangle(x - 2, y - 2, size + 4, size + 4)
        .setOrigin(0)
        .setStrokeStyle(2, hex(PAL.gold), 1)
        .setScrollFactor(0)
        .setVisible(false);
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
      this.hotbar.push({ ring, frame, icon, count: countLabel, key });
    }
  }

  private updateHotbar(): void {
    const [primary, secondary, food] = this.hotbar;
    const equipped = state.player.equipped;
    const find = (uid: string | null) => state.player.weapons.find((w) => w.uid === uid);

    const active = state.player.activeSlot ?? 0;
    const hasRack = ResourceSystem.campEffects().weaponSlots > 1;

    const rarityOf = (w: { rarity: string } | undefined) =>
      w && w.rarity !== 'common' ? (RARITY_COLOR as Record<string, string>)[w.rarity] ?? PAL.greyDark : PAL.greyDark;

    const w1 = find(equipped[0]);
    primary.icon.setVisible(!!w1);
    if (w1) primary.icon.setTexture(WEAPON_ICON_KEY[w1.base] ?? 'fx-dot1').setScale(1.6).setAlpha(1);
    primary.frame.setStrokeStyle(1, hex(rarityOf(w1))).setAlpha(0.9);
    primary.ring.setVisible(active === 0);
    primary.count.setText('');

    const w2 = find(equipped[1]);
    secondary.icon.setVisible(!!w2);
    if (w2) secondary.icon.setTexture(WEAPON_ICON_KEY[w2.base] ?? 'fx-dot1').setScale(1.6).setAlpha(1);
    secondary.frame.setStrokeStyle(1, hex(rarityOf(w2))).setAlpha(hasRack ? 0.9 : 0.45);
    secondary.ring.setVisible(active === 1 && hasRack);
    secondary.count.setText('');

    const foodCount = hud.context === 'world' ? (hud.carried.food ?? 0) : (state.camp.storage.food ?? 0);
    food.icon.setVisible(true).setTexture(RESOURCE_ICON.food).setScale(1.5).setAlpha(foodCount > 0 ? 1 : 0.35);
    food.count.setText(foodCount > 0 ? String(Math.min(99, foodCount)) : '');
    food.frame.setStrokeStyle(1, hex(foodCount > 0 ? PAL.green : PAL.greyDark));
    food.ring.setVisible(false);
  }

  private buildResourceRows(): void {
    const { height } = BAL.view;
    const y = height - 15;
    const slot = 42;

    // A permanent strip along the bottom left. Every resource is always shown, even at
    // zero, so a new player can see what the game counts before they have any of it.
    this.resourcePanel = makeFrame(this, 2, y - 4, RESOURCE_IDS.length * slot + 6, 18, {
      fill: PAL.black,
      alpha: 0.6,
    }).setScrollFactor(0);

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
    // Above the hotbar row normally; above the reading panel when one is open.
    const base = hud.dialogueOpen ? height - 112 : height - 58;
    const label = new Label(this, Math.round(width / 2), base, text, {
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
    const low = hud.hp > 0 && hud.hp / hud.maxHp < 0.3;
    const pulse = 0.5 + 0.5 * Math.sin(_time / 260);
    this.hurtWash.setAlpha(low ? 0.35 + 0.3 * pulse : 0);
    this.hpText.setTint(low && pulse > 0.5 ? PAL.ember : PAL.white);

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

    // In the world the number sits inside the dial; at camp there is no dial, so it
    // says the whole thing.
    this.dayLabel.setText(inWorld ? String(hud.day) : `DAY ${hud.day}`);
    this.dayLabel.container.y = inWorld ? 13 : 6;
    this.hpText.setText(`${Math.max(0, Math.ceil(hud.hp))}/${Math.round(hud.maxHp)}`);
    this.coldText.setText(String(Math.round(hud.cold)));
    this.clock.setVisible(inWorld);
    this.eventLabel.setVisible(inWorld && hud.eventName !== '');
    this.eventLabel.setText(hud.eventName);
    this.clockArc.setVisible(inWorld);
    this.dialBack.setVisible(inWorld);
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

    const inFight = inWorld && hud.bossName !== null;
    this.bossBack.setVisible(inFight);
    this.bossFill.setVisible(inFight);
    this.bossLabel.setVisible(inFight);
    if (inFight) {
      this.bossFill.width = Math.max(0, Math.round(160 * (hud.bossHp / Math.max(1, hud.bossMaxHp))));
      this.bossLabel.setText((hud.bossName ?? '').toUpperCase());
    }
    this.pauseButton.setVisible(inWorld);
    this.compassHit.setVisible(inWorld);
    this.minimap.setVisible(inWorld && !hud.mapHidden);
    this.minimap.update(hud.playerX, hud.playerY, _time, hud.marks);
    const next = nextObjective();
    this.objectiveTag.setVisible(next !== null);
    this.objective.setText(next ? next.text : '');
    this.pauseGlyph.setVisible(inWorld);
    this.compass.setVisible(inWorld && hud.homeAngle !== null && !hud.mapHidden);
    if (hud.homeAngle !== null) {
      this.compass.setPosition(
        width - 86 + Math.cos(hud.homeAngle) * 9,
        30 + Math.sin(hud.homeAngle) * 9,
      );
    }

    this.updateResources();
  }

  private drawClockArc(width: number): void {
    const cx = Math.round(width / 2);
    const cy = 17;
    const r = 13;
    const top = -Math.PI / 2;

    // The face: one wedge per phase, in the colour of that light.
    const back = this.dialBack;
    back.clear();
    back.fillStyle(hex(PAL.black), 0.65);
    back.fillCircle(cx, cy, r + 3);
    const phases = BAL.day.phases;
    const total = BAL.day.length;
    const colours: Record<string, string> = {
      morning: PAL.gold,
      midday: PAL.cream,
      evening: PAL.orange,
      nightfall: PAL.violetDark,
      night: PAL.navy,
    };
    let from = 0;
    for (const p of phases) {
      const until = Math.min(p.until, total);
      if (until <= from) continue;
      const a0 = top + (from / total) * Math.PI * 2;
      const a1 = top + (until / total) * Math.PI * 2;
      back.fillStyle(hex(colours[p.id] ?? PAL.navy), 0.55);
      back.slice(cx, cy, r, a0, a1, false);
      back.fillPath();
      from = until;
    }
    back.lineStyle(1, hex(PAL.grey), 0.9);
    back.strokeCircle(cx, cy, r + 0.5);

    // The hand.
    const g = this.clockArc;
    g.clear();
    const progress = Phaser.Math.Clamp(hud.dayProgress, 0, 1);
    const angle = top + progress * Math.PI * 2;
    const night = hud.phaseName === 'NIGHT' || hud.phaseName === 'NIGHTFALL';
    g.lineStyle(2, hex(night ? PAL.ice : PAL.white), 1);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(angle) * (r - 2), cy + Math.sin(angle) * (r - 2));
    g.strokePath();
    g.fillStyle(hex(night ? PAL.ice : PAL.white), 1);
    g.fillCircle(cx + Math.cos(angle) * (r - 2), cy + Math.sin(angle) * (r - 2), 1.5);
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
  }
}
