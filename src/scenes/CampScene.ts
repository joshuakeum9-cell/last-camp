import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus, Subscriptions } from '../core/EventBus';
import { newRunState, state } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { InputSystem } from '../core/InputSystem';
import { Player } from '../entities/Player';
import { Juice } from '../systems/Juice';
import { Weather } from '../systems/Weather';
import { ResourceSystem } from '../systems/ResourceSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { CampSystem, type CampPlacement, type StationId } from '../systems/CampSystem';
import { SOLID_TILES, TILE, TILE_SIZE } from '../art/sprites/tiles';
import { TilesetBuilder, applyTransitions } from '../art/sprites/transitions';
import { isSolidIndex } from '../systems/MapGen';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import { campfireSprite, PORTAL_FRAME_KEYS } from '../art/sprites/camp';
import { FX } from '../art/sprites/fx';
import { hex, PAL } from '../art/palette';
import { FONT } from '../art/PixelFont';
import { Rng } from '../core/Rng';
import { hud, resetHud } from '../core/HudState';
import { Label } from '../ui/Label';
import { Prompt } from '../ui/Prompt';
import { NPCMira } from '../entities/NPCMira';
import { Dialogue } from '../ui/Dialogue';
import { TouchControls } from '../ui/TouchControls';
import { NOTE_LIST } from '../data/story';

interface Station {
  id: StationId;
  x: number;
  y: number;
  radius: number;
  label: string;
}

/**
 * The camp. Warm, small and safe: the emotional opposite of the map. Everything bought
 * in the menu appears here on the ground, so progress is something you walk past.
 */
export class CampScene extends Phaser.Scene {
  private input$!: InputSystem;
  private player!: Player;
  private juice!: Juice;
  private weather!: Weather;
  private subs = new Subscriptions();

  private layer!: Phaser.Tilemaps.TilemapLayer;
  private campLayer!: Phaser.GameObjects.Container;
  private lightLayer!: Phaser.GameObjects.Container;
  private stations: Station[] = [];
  private prompt!: Prompt;
  private dialogue!: Dialogue;
  private touch!: TouchControls;
  private mira: NPCMira | null = null;
  private cold = 0;
  private fireX = 15 * TILE_SIZE + 8;
  private fireY = 12 * TILE_SIZE;
  private portalX = 0;
  private portalY = 0;
  private portalFrame = 0;
  private leaving = false;

  constructor() {
    super('Camp');
  }

  create(): void {
    state.run = null;
    resetHud();
    hud.context = 'camp';
    UpgradeSystem.refreshCampLevel();
    SaveSystem.save();

    this.buildGround();
    this.buildTreeline();

    this.campLayer = this.add.container(0, 0);
    this.lightLayer = this.add.container(0, 0);

    this.player = new Player(this, 15 * TILE_SIZE + 8, 16 * TILE_SIZE);
    // You come home as you left the wilderness. The fire does the rest, slowly.
    this.player.setMaxHp(ResourceSystem.maxHp(), false);
    this.player.hp = Math.max(1, Math.min(state.player.hp, this.player.maxHp));
    this.cold = Math.max(0, Math.min(BAL.cold.max, state.player.cold));
    this.physics.add.collider(this.player.sprite, this.layer);

    this.rebuildCamp();

    this.input$ = new InputSystem(this);
    this.juice = new Juice(this);
    this.weather = new Weather(this);

    this.buildAmbient();
    this.dialogue = new Dialogue(this);
    this.prompt = new Prompt(this);

    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);
    cam.setBounds(0, 0, BAL.camp.cols * TILE_SIZE, BAL.camp.rows * TILE_SIZE);
    cam.setBackgroundColor(PAL.navy);
    cam.fadeIn(320, 0, 0, 0);

    this.touch = new TouchControls(this);
    this.subs.add(bus.on('settings:changed', () => this.touch.refreshSettings()));
    this.subs.add(
      bus.on('hud:slot', ({ slot }) => {
        if (slot === 2) {
          this.juice.floatText(this.player.cx, this.player.sprite.y - 24, 'Save it for the trail', PAL.grey);
          return;
        }
        if (!state.player.equipped[slot] || state.player.activeSlot === slot) return;
        state.player.activeSlot = slot as 0 | 1;
        bus.emit('audio:play', { cue: 'swap' });
      }),
    );

    if (!this.scene.isActive('HUD')) this.scene.launch('HUD');
    this.scene.bringToTop('HUD');

    this.showMorningReport();
    this.events.once('shutdown', () => this.cleanup());
  }

  // --- ground ------------------------------------------------------------

  private buildGround(): void {
    const { cols, rows } = BAL.camp;
    const rng = new Rng(7);
    const data: number[][] = [];
    const kinds: Array<Array<string | null>> = [];

    for (let y = 0; y < rows; y++) {
      const row: number[] = [];
      const kindRow: Array<string | null> = [];
      for (let x = 0; x < cols; x++) {
        if (x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2) {
          row.push(TILE.CLIFF);
          kindRow.push(null);
          continue;
        }
        // Trodden ground only where people actually walk: a ragged patch round the fire.
        const dist = Math.hypot((x - 15) * 0.85, y - 12);
        const ragged =
          dist + Math.sin(x * 0.9) * 0.8 + Math.cos(y * 1.3 + x * 0.4) * 0.7 + rng.range(-0.4, 0.4);
        // One clean edge. Scattering trodden tiles through a band put a seam on
        // nearly every tile and the feathering turned the whole yard into a maze.
        // The wobble in `ragged` is what keeps the edge from being a circle.
        if (ragged < 7.2) {
          row.push(rng.pick([TILE.CAMP_A, TILE.CAMP_A, TILE.CAMP_B]));
          kindRow.push('camp');
        } else {
          row.push(rng.pick([TILE.SNOW_A, TILE.SNOW_A, TILE.SNOW_B, TILE.SNOW_C]));
          kindRow.push('snow');
        }
      }
      data.push(row);
      kinds.push(kindRow);
    }

    // Snow caps only where a wall actually faces the camera.
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols; x++) {
        if (data[y][x] === TILE.CLIFF && data[y + 1][x] !== TILE.CLIFF) {
          data[y][x] = TILE.CLIFF_TOP;
        }
      }
    }

    const builder = new TilesetBuilder();
    applyTransitions(kinds, data, builder, isSolidIndex);
    builder.build(this, 'tileset-camp');

    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('tiles', 'tileset-camp', TILE_SIZE, TILE_SIZE, 0, 0);
    const layer = map.createLayer(0, tileset!, 0, 0);
    if (!layer) throw new Error('[CampScene] tile layer could not be created');
    this.layer = layer;
    this.layer.setCollision(SOLID_TILES);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  private buildTreeline(): void {
    const rng = new Rng(11);
    for (let i = 0; i < 18; i++) {
      const edge = rng.int(0, 3);
      const x = edge < 2 ? rng.int(2, 28) : edge === 2 ? rng.int(2, 5) : rng.int(25, 28);
      const y = edge < 2 ? (edge === 0 ? rng.int(2, 4) : rng.int(16, 18)) : rng.int(2, 18);
      if (Math.hypot(x - 15, y - 12) < 10) continue;
      // Nothing leaning over the portal.
      if (Math.hypot(x - 26, y - 13) < 4.5) continue;
      const px = x * TILE_SIZE + 8;
      const py = y * TILE_SIZE + TILE_SIZE;
      this.add
        .ellipse(px, py - 1, 22, 7, hex(PAL.blue))
        .setAlpha(0.28)
        .setDepth(py - 2);
      this.add
        .image(px, py, rng.chance(0.3) ? SCENERY_KEYS.pineSmall : SCENERY_KEYS.pine)
        .setOrigin(0.5, 1)
        .setScale(1.3)
        .setDepth(py);
    }
  }

  // --- the camp itself ---------------------------------------------------

  /** Rebuilt whenever something is bought, so a purchase changes the view at once. */
  rebuildCamp(): void {
    this.campLayer.removeAll(true);
    this.lightLayer.removeAll(true);
    this.stations = [];

    for (const p of CampSystem.placements()) this.place(p);

    for (const light of CampSystem.lightSources()) {
      const glow = this.add
        .image(light.tx * TILE_SIZE + 8, light.ty * TILE_SIZE, FX.glowLarge)
        .setTint(hex(PAL.orange))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(light.intensity)
        .setScale(light.radius / 80)
        .setDepth(4990);
      this.lightLayer.add(glow);
      this.tweens.add({
        targets: glow,
        alpha: light.intensity * 1.35,
        scale: (light.radius / 80) * 1.12,
        duration: 820 + light.tx * 37,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Mira lives here once she is out of the cabin. The camp stops being empty.
    this.mira?.destroy();
    this.mira = null;
    if (state.story.miraRescued) {
      this.mira = new NPCMira(this, 13 * TILE_SIZE + 8, 13 * TILE_SIZE, 'camp');
      this.stations.push({
        id: 'mira',
        x: this.mira.cx,
        y: this.mira.cy,
        radius: 28,
        label: STATION_LABEL.mira,
      });
    }

  }

  private place(p: CampPlacement): void {
    const x = p.tx * TILE_SIZE + 8;
    const y = p.ty * TILE_SIZE + TILE_SIZE;
    const depth = p.behind ? 1 : y;

    if (p.key === 'portal') {
      this.placePortal(x, y, p.scale);
      return;
    }

    let obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    if (p.key === 'campfire') {
      obj = this.add.sprite(x, y, campfireSprite.key).play(`${campfireSprite.key}_burn`);
      const embers = this.add.particles(x, y - 6, FX.dot1, {
        speedY: { min: -34, max: -14 },
        speedX: { min: -9, max: 9 },
        lifespan: { min: 900, max: 1700 },
        scale: { min: 0.8, max: 1.6 },
        alpha: { start: 0.9, end: 0 },
        tint: [hex(PAL.gold), hex(PAL.orange), hex(PAL.ember)],
        frequency: 160,
        blendMode: Phaser.BlendModes.ADD,
      });
      embers.setDepth(y + 1);
      this.campLayer.add(embers);
    } else {
      obj = this.add.image(x, y, p.key);
    }

    obj.setOrigin(0.5, 1).setScale(p.scale).setDepth(depth).setFlipX(!!p.flip);
    this.campLayer.add(obj);

    if (p.station) {
      this.stations.push({
        id: p.station,
        x,
        y: y - obj.displayHeight * 0.4,
        radius: 26,
        label: STATION_LABEL[p.station],
      });
    }
  }

  /**
   * The way out. It is a thing you walk into, not a thing you press a key at, so
   * heading out feels like a decision made with your feet.
   */
  private placePortal(x: number, y: number, scale: number): void {
    const centreY = y - 12 * scale;
    this.portalX = x;
    this.portalY = centreY;

    const glow = this.add
      .image(x, centreY, FX.glowMed)
      .setTint(hex(PAL.violet))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.55)
      .setScale(1.1)
      .setDepth(y - 1);
    this.campLayer.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: 0.85,
      scale: 1.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const swirl = this.add
      .sprite(x, y, PORTAL_FRAME_KEYS[0])
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setDepth(y);
    this.campLayer.add(swirl);
    this.time.addEvent({
      delay: 130,
      loop: true,
      callback: () => {
        if (!swirl.active) return;
        this.portalFrame = (this.portalFrame + 1) % PORTAL_FRAME_KEYS.length;
        swirl.setTexture(PORTAL_FRAME_KEYS[this.portalFrame]);
      },
    });

    // Motes drawn in from around the rim, so it reads as pulling rather than pushing.
    const motes = this.add.particles(x, centreY, FX.dot1, {
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Ellipse(0, 0, 40 * scale, 56 * scale),
        quantity: 24,
      },
      moveToX: 0,
      moveToY: 0,
      lifespan: { min: 500, max: 900 },
      scale: { start: 1.4, end: 0.3 },
      alpha: { start: 0.9, end: 0 },
      tint: [hex(PAL.cyan), hex(PAL.violet), hex(PAL.white)],
      frequency: 70,
      blendMode: Phaser.BlendModes.ADD,
    });
    motes.setDepth(y + 1);
    this.campLayer.add(motes);

    const sign = new Label(this, x, centreY - 22 * scale, 'HEAD OUT', {
      color: PAL.cyan,
      originX: 0.5,
      align: 'center',
    }).setDepth(y + 2);
    this.campLayer.add(sign.container);
    this.tweens.add({
      targets: sign.container,
      y: centreY - 22 * scale - 3,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private buildAmbient(): void {
    const { width, height } = BAL.view;
    this.add
      .rectangle(0, 0, width, height, hex(PAL.orange))
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0.1)
      .setDepth(5000);
  }

  /**
   * One line before the player leaves: the weather, and something that happened while
   * they slept. It gives every day a hook of its own.
   */
  private showMorningReport(): void {
    if (state.story.reportSeenDay === state.day) return;
    state.story.reportSeenDay = state.day;

    const lines: string[] = [];
    if (state.day === 1) {
      lines.push('You do not remember getting here. The fire was already burning.');
    } else if (state.day >= BAL.day.stormFromDay) {
      lines.push('The sky is the colour of old iron. There is weather coming.');
    } else {
      lines.push('Clear, and colder than yesterday.');
    }

    if (state.stats.deaths > 0 && state.day > 1) {
      lines.push('Your hands still do not work properly.');
    }
    if (state.map.discoveredAreas.includes('road') && !state.story.miraRescued) {
      lines.push('Something was howling out past the road last night.');
    }

    const { width } = BAL.view;
    const text = lines.join('\n');
    const lineCount = lines.length;
    // A panel behind it, because this lands over open snow and a thin outline is not
    // enough for a sentence you are meant to actually read.
    const panel = this.add
      .rectangle(Math.round(width / 2), 36, width - 60, 10 + lineCount * 11, hex(PAL.black))
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setStrokeStyle(1, hex(PAL.blueDark), 0.8)
      .setScrollFactor(0)
      .setDepth(7599);

    const label = new Label(this, Math.round(width / 2), 41, text, {
      color: PAL.cream,
      originX: 0.5,
      align: 'center',
    })
      .setScrollFactor(0)
      .setDepth(7600)
      .setAlpha(0);

    this.tweens.add({
      targets: panel,
      alpha: 0.72,
      duration: 600,
      hold: 3200,
      yoyo: true,
      onComplete: () => panel.destroy(),
    });

    this.tweens.add({
      targets: label.target,
      alpha: 1,
      duration: 600,
      hold: 3200,
      yoyo: true,
      onComplete: () => label.destroy(),
    });
  }

  // --- interactions ------------------------------------------------------

  private useStation(id: StationId): void {
    switch (id) {
      case 'fire':
        // No instant heal. Standing here is what heals you, and it says so.
        this.juice.floatText(this.player.cx, this.player.sprite.y - 24, 'Stay close', PAL.gold);
        bus.emit('audio:play', { cue: 'warm' });
        break;

      case 'workbench':
      case 'weaponrack':
        this.openMenu('weapons');
        break;

      case 'storage':
      case 'cookpot':
      case 'medtable':
        this.openMenu('inventory');
        break;

      case 'shelter':
      case 'watchtower':
      case 'signaltable':
        this.openMenu('camp');
        break;

      case 'board':
        this.showJournal();
        break;

      case 'mira':
        if (this.mira) {
          const lines = this.mira.interact();
          if (lines.length) this.dialogue.show(lines, 'Mira');
        }
        break;

      default:
        this.openMenu('camp');
    }
  }

  /** The journal: what has been found, and how much has not. */
  private showJournal(): void {
    const found = state.story.notesFound;
    const lines: string[] = [`Notes found: ${found.length} of ${NOTE_LIST.length}.`];

    for (const note of NOTE_LIST) {
      if (found.includes(note.id)) lines.push(`${note.title}\n\n${note.body}`);
    }
    if (found.length === 0) {
      lines.push('Nothing written down yet. Somebody must have left something out there.');
    } else if (found.length < NOTE_LIST.length) {
      lines.push('There is more of this somewhere.');
    } else {
      lines.push('That is all of it. It still does not say why.');
    }

    this.dialogue.show(lines, 'Notice board');
  }

  private openMenu(tab: string): void {
    this.input$.flush();
    this.scene.pause();
    this.scene.launch('Menu', { tab });
    this.scene.bringToTop('Menu');
  }

  private headOut(): void {
    if (this.leaving) return;
    this.leaving = true;

    const storm = state.day >= BAL.day.stormFromDay && Math.random() < BAL.day.stormChance;
    state.run = newRunState(Date.now() & 0xffffff, ResourceSystem.maxHp(), storm);
    SaveSystem.save();
    bus.emit('day:started', { day: state.day });
    bus.emit('audio:play', { cue: 'portal' });

    // Pulled into the swirl: the sprite shrinks to the portal's centre as the
    // screen goes to black.
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null;
    body?.setVelocity(0, 0);
    this.tweens.add({
      targets: this.player.sprite,
      x: this.portalX,
      y: this.portalY + 6,
      scale: 0.15,
      alpha: 0.2,
      angle: 180,
      duration: 340,
      ease: 'Quad.easeIn',
    });
    this.cameras.main.flash(120, 140, 80, 255);
    this.cameras.main.fadeOut(360, 0, 0, 0);
    this.time.delayedCall(400, () => this.scene.start('World'));
  }

  // --- loop --------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    if (this.leaving) {
      this.weather.update(dt, 0.1);
      return;
    }
    const input = this.input$.update(this.player.cx, this.player.cy);
    this.player.update(dt, input);

    // Walk into the portal and the day starts. No prompt, no key.
    if (
      !this.dialogue.isOpen &&
      Phaser.Math.Distance.Between(this.player.cx, this.player.cy, this.portalX, this.portalY) <
        BAL.camp.portalRadius
    ) {
      this.headOut();
      return;
    }
    this.weather.update(dt, 0.1);

    this.recoverAtFire(dt);

    hud.context = 'camp';
    hud.hp = this.player.hp;
    hud.maxHp = this.player.maxHp;
    hud.cold = this.cold;
    hud.day = state.day;
    hud.dashCharge = this.player.dashCharge;

    if (this.dialogue.isOpen) {
      this.prompt.hide();
      if (input.interactPressed) this.dialogue.advance();
      return;
    }

    let nearest: Station | null = null;
    let nearestDist = Infinity;
    for (const s of this.stations) {
      const d = Phaser.Math.Distance.Between(this.player.cx, this.player.cy, s.x, s.y);
      if (d < s.radius && d < nearestDist) {
        nearest = s;
        nearestDist = d;
      }
    }

    this.touch.update(!!nearest, !!state.player.equipped[1]);

    if (nearest) {
      this.prompt.show(nearest.label, this.player.cx, this.player.sprite.y - 30);
      if (input.interactPressed) this.useStation(nearest.id);
    } else {
      this.prompt.hide();
    }
  }

  /**
   * The firelight is what mends you. Health comes back and the cold drains off while
   * you stand in it, and both stop the moment you step away, so returning to camp is
   * an act rather than a reset.
   */
  private recoverAtFire(dt: number): void {
    const seconds = dt / 1000;
    const dist = Phaser.Math.Distance.Between(this.player.cx, this.player.cy, this.fireX, this.fireY);
    const inLight = dist < BAL.camp.fireRadius;

    if (inLight) {
      if (this.player.hp < this.player.maxHp) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + BAL.camp.fireHealPerSec * seconds);
      }
      if (this.cold > 0) {
        this.cold = Math.max(0, this.cold - BAL.camp.fireColdPerSec * seconds);
      }
    }

    state.player.hp = this.player.hp;
    state.player.cold = this.cold;
  }

  private cleanup(): void {
    this.subs.dispose();
    this.dialogue?.close();
    this.mira?.destroy();
    this.weather?.destroy();
    this.juice?.destroy();
    this.player?.destroy();
  }
}

/** Verbs only. The prompt widget adds the key, so touch players see a tap mark. */
const STATION_LABEL: Record<StationId, string> = {
  fire: 'Warm up',
  workbench: 'Use workbench',
  storage: 'Open storage',
  board: 'Read the board',
  shelter: 'Rest in shelter',
  cookpot: 'Cook',
  medtable: 'Treat wounds',
  weaponrack: 'Choose weapon',
  watchtower: 'Climb the tower',
  signaltable: 'Work the radio',
  mira: 'Talk to Mira',
  supplydrop: 'Open supply drop',
};
