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
import { SOLID_TILES, TILE, TILESET_KEY, TILE_SIZE } from '../art/sprites/tiles';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import { campfireSprite } from '../art/sprites/camp';
import { FX } from '../art/sprites/fx';
import { hex, PAL } from '../art/palette';
import { FONT } from '../art/PixelFont';
import { Rng } from '../core/Rng';
import { hud, resetHud } from '../core/HudState';
import { Label } from '../ui/Label';
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
  private prompt!: Label;
  private dialogue!: Dialogue;
  private touch!: TouchControls;
  private mira: NPCMira | null = null;

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
    this.player.setMaxHp(ResourceSystem.maxHp(), true);
    this.physics.add.collider(this.player.sprite, this.layer);

    this.rebuildCamp();

    this.input$ = new InputSystem(this);
    this.juice = new Juice(this);
    this.weather = new Weather(this);

    this.buildAmbient();
    this.dialogue = new Dialogue(this);
    this.prompt = new Label(this, 0, 0, '', {
      color: PAL.gold,
      originX: 0.5,
      originY: 1,
    })
      .setDepth(7500)
      .setVisible(false);

    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);
    cam.setBounds(0, 0, BAL.camp.cols * TILE_SIZE, BAL.camp.rows * TILE_SIZE);
    cam.setBackgroundColor(PAL.navy);
    cam.fadeIn(320, 0, 0, 0);

    this.touch = new TouchControls(this);
    this.subs.add(bus.on('settings:changed', () => this.touch.refreshSettings()));

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

    for (let y = 0; y < rows; y++) {
      const row: number[] = [];
      for (let x = 0; x < cols; x++) {
        if (x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2) {
          row.push(TILE.CLIFF);
          continue;
        }
        // Trodden ground only where people actually walk: a ragged patch round the fire.
        const dist = Math.hypot((x - 15) * 0.85, y - 12);
        const ragged =
          dist + Math.sin(x * 0.9) * 0.8 + Math.cos(y * 1.3 + x * 0.4) * 0.7 + rng.range(-0.4, 0.4);
        if (ragged < 6.4) row.push(rng.pick([TILE.CAMP_A, TILE.CAMP_A, TILE.CAMP_B]));
        else if (ragged < 8.4) row.push(rng.chance(0.45) ? TILE.CAMP_B : TILE.SNOW_B);
        else row.push(rng.pick([TILE.SNOW_A, TILE.SNOW_A, TILE.SNOW_B, TILE.SNOW_C]));
      }
      data.push(row);
    }

    // Snow caps only where a wall actually faces the camera.
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols; x++) {
        if (data[y][x] === TILE.CLIFF && data[y + 1][x] !== TILE.CLIFF) {
          data[y][x] = TILE.CLIFF_TOP;
        }
      }
    }

    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('tiles', TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
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

    // The way out is always available, wherever the camp has got to.
    this.stations.push({
      id: 'gate',
      x: 22 * TILE_SIZE + 8,
      y: 12.5 * TILE_SIZE,
      radius: 32,
      label: `E  HEAD OUT.  DAY ${state.day}`,
    });
  }

  private place(p: CampPlacement): void {
    const x = p.tx * TILE_SIZE + 8;
    const y = p.ty * TILE_SIZE + TILE_SIZE;
    const depth = p.behind ? 1 : y;

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
        this.player.heal(this.player.maxHp, 'fire');
        this.juice.floatText(this.player.cx, this.player.sprite.y - 24, 'WARM', PAL.gold);
        bus.emit('audio:play', { cue: 'warm' });
        break;

      case 'gate':
        this.headOut();
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
    const storm = state.day >= BAL.day.stormFromDay && Math.random() < BAL.day.stormChance;
    state.run = newRunState(Date.now() & 0xffffff, ResourceSystem.maxHp(), storm);
    SaveSystem.save();
    bus.emit('day:started', { day: state.day });

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(310, () => this.scene.start('World'));
  }

  // --- loop --------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    const input = this.input$.update(this.player.cx, this.player.cy);
    this.player.update(dt, input);
    this.weather.update(dt, 0.1);

    hud.context = 'camp';
    hud.hp = this.player.hp;
    hud.maxHp = this.player.maxHp;
    hud.day = state.day;
    hud.dashCharge = this.player.dashCharge;

    if (this.dialogue.isOpen) {
      this.prompt.setVisible(false);
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
      this.prompt
        .setText(nearest.label)
        .setPosition(Math.round(this.player.cx), Math.round(this.player.sprite.y) - 26)
        .setVisible(true);
      if (input.interactPressed) this.useStation(nearest.id);
    } else {
      this.prompt.setVisible(false);
    }
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

const STATION_LABEL: Record<StationId, string> = {
  fire: 'E  WARM UP',
  workbench: 'E  WORKBENCH',
  storage: 'E  STORAGE',
  board: 'E  NOTICE BOARD',
  shelter: 'E  SHELTER',
  cookpot: 'E  COOKING POT',
  medtable: 'E  MEDICAL TABLE',
  weaponrack: 'E  WEAPON RACK',
  watchtower: 'E  WATCHTOWER',
  signaltable: 'E  SIGNAL TABLE',
  mira: 'E  TALK TO MIRA',
  supplydrop: 'E  SUPPLY DROP',
  gate: 'E  HEAD OUT',
};
