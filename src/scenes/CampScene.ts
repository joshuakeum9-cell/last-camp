import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus, Subscriptions } from '../core/EventBus';
import { newRunState, state } from '../core/GameState';
import { SaveSystem } from '../core/SaveSystem';
import { InputSystem } from '../core/InputSystem';
import { Player } from '../entities/Player';
import { Juice } from '../systems/Juice';
import { Weather } from '../systems/Weather';
import { SOLID_TILES, TILE, TILESET_KEY, TILE_SIZE } from '../art/sprites/tiles';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import { CAMP_KEYS, campfireSprite } from '../art/sprites/camp';
import { FX } from '../art/sprites/fx';
import { hex, PAL } from '../art/palette';
import { FONT } from '../art/PixelFont';
import { Rng } from '../core/Rng';
import { hud, resetHud } from '../core/HudState';

interface Station {
  x: number;
  y: number;
  radius: number;
  label: string;
  action: () => void;
}

/**
 * The camp. Warm, small and safe: the emotional opposite of the map. Phase 4 adds the
 * upgrade menus and the level 1 to 5 transformations.
 */
export class CampScene extends Phaser.Scene {
  private input$!: InputSystem;
  private player!: Player;
  private juice!: Juice;
  private weather!: Weather;
  private subs = new Subscriptions();

  private layer!: Phaser.Tilemaps.TilemapLayer;
  private stations: Station[] = [];
  private prompt!: Phaser.GameObjects.BitmapText;
  private fireGlow!: Phaser.GameObjects.Image;

  constructor() {
    super('Camp');
  }

  create(): void {
    state.run = null;
    resetHud();
    hud.context = 'camp';
    SaveSystem.save();

    this.buildGround();
    this.player = new Player(this, 15 * TILE_SIZE + 8, 15 * TILE_SIZE);
    this.physics.add.collider(this.player.sprite, this.layer);

    this.buildCamp();

    this.input$ = new InputSystem(this);
    this.juice = new Juice(this);
    this.weather = new Weather(this);

    this.buildAmbient();
    this.prompt = this.add
      .bitmapText(0, 0, FONT, '')
      .setOrigin(0.5, 1)
      .setTint(hex(PAL.gold))
      .setDepth(7500)
      .setVisible(false);

    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, 0.1, 0.1);
    cam.setBounds(0, 0, BAL.camp.cols * TILE_SIZE, BAL.camp.rows * TILE_SIZE);
    cam.setBackgroundColor(PAL.navy);
    cam.fadeIn(320, 0, 0, 0);

    if (!this.scene.isActive('HUD')) this.scene.launch('HUD');
    this.scene.bringToTop('HUD');

    this.events.once('shutdown', () => this.cleanup());
  }

  private buildGround(): void {
    const { cols, rows } = BAL.camp;
    const rng = new Rng(7);
    const data: number[][] = [];
    for (let y = 0; y < rows; y++) {
      const row: number[] = [];
      for (let x = 0; x < cols; x++) {
        const edge = x < 2 || y < 2 || x >= cols - 2 || y >= rows - 2;
        if (edge) {
          row.push(TILE.CLIFF);
          continue;
        }
        // Trodden ground only where people actually walk: a ragged patch round the fire.
        const dist = Math.hypot((x - 15) * 0.85, y - 12);
        const ragged =
          dist +
          Math.sin(x * 0.9) * 0.8 +
          Math.cos(y * 1.3 + x * 0.4) * 0.7 +
          rng.range(-0.4, 0.4);
        if (ragged < 4.4) row.push(rng.pick([TILE.CAMP_A, TILE.CAMP_A, TILE.CAMP_B]));
        else if (ragged < 6.2) row.push(rng.chance(0.45) ? TILE.CAMP_B : TILE.SNOW_B);
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

  private buildCamp(): void {
    const t = (n: number) => n * TILE_SIZE;

    // Trees around the edge, so the camp feels like a clearing someone chose.
    const rng = new Rng(11);
    for (let i = 0; i < 16; i++) {
      const edge = rng.int(0, 3);
      const x = edge < 2 ? rng.int(2, 28) : edge === 2 ? rng.int(2, 5) : rng.int(25, 28);
      const y = edge < 2 ? (edge === 0 ? rng.int(2, 4) : rng.int(16, 18)) : rng.int(2, 18);
      if (Math.hypot(x - 15, y - 11) < 8) continue;
      this.add
        .image(t(x) + 8, t(y) + 16, rng.chance(0.3) ? SCENERY_KEYS.pineSmall : SCENERY_KEYS.pine)
        .setOrigin(0.5, 1)
        .setScale(1.25)
        .setDepth(t(y) + 16);
    }

    // --- the fire --------------------------------------------------------
    const fx = t(15);
    const fy = t(12);
    this.fireGlow = this.add
      .image(fx, fy - 8, FX.glowLarge)
      .setTint(hex(PAL.orange))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.45)
      .setScale(1.0)
      .setDepth(fy - 20);
    this.tweens.add({
      targets: this.fireGlow,
      alpha: 0.62,
      scale: 1.14,
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.add
      .sprite(fx, fy, campfireSprite.key)
      .setOrigin(0.5, 1)
      .setScale(1.75)
      .setDepth(fy)
      .play(`${campfireSprite.key}_burn`);

    // Embers drifting up from the fire. Small, but it makes the camp feel alive.
    const embers = this.add.particles(fx, fy - 6, FX.dot1, {
      speedY: { min: -34, max: -14 },
      speedX: { min: -9, max: 9 },
      lifespan: { min: 900, max: 1700 },
      scale: { min: 0.8, max: 1.6 },
      alpha: { start: 0.9, end: 0 },
      tint: [hex(PAL.gold), hex(PAL.orange), hex(PAL.ember)],
      frequency: 180,
      blendMode: Phaser.BlendModes.ADD,
    });
    embers.setDepth(fy + 1);

    // --- props -----------------------------------------------------------
    const tent = this.add
      .image(t(11) + 8, t(11), CAMP_KEYS.tentBroken)
      .setOrigin(0.5, 1)
      .setScale(1.5)
      .setDepth(t(11));
    const crate = this.add
      .image(t(19), t(13), CAMP_KEYS.crateStack)
      .setOrigin(0.5, 1)
      .setScale(1.4)
      .setDepth(t(13));
    this.add
      .image(t(13), t(14) + 6, CAMP_KEYS.log)
      .setOrigin(0.5, 1)
      .setScale(1.5)
      .setDepth(t(14) + 6);
    const board = this.add
      .image(t(18), t(9), CAMP_KEYS.noticeBoard)
      .setOrigin(0.5, 1)
      .setScale(1.4)
      .setDepth(t(9));

    // --- the gate out ----------------------------------------------------
    for (const gy of [10, 14]) {
      this.add
        .image(t(25), t(gy), CAMP_KEYS.gatePost)
        .setOrigin(0.5, 1)
        .setScale(1.6)
        .setDepth(t(gy));
    }

    this.stations = [
      { x: fx, y: fy - 6, radius: 26, label: 'E  WARM UP', action: () => this.warmUp() },
      {
        x: crate.x,
        y: crate.y - 6,
        radius: 22,
        label: 'E  STORAGE',
        action: () => this.notYet('Storage opens once you have something to store.'),
      },
      {
        x: board.x,
        y: board.y - 6,
        radius: 22,
        label: 'E  NOTICE BOARD',
        action: () => this.notYet('The board is bare. Nothing has happened yet.'),
      },
      {
        x: tent.x,
        y: tent.y - 6,
        radius: 24,
        label: 'E  SHELTER',
        action: () => this.notYet('The tent barely keeps the wind out.'),
      },
      { x: t(25), y: t(12), radius: 30, label: `E  HEAD OUT.  DAY ${state.day}`, action: () => this.headOut() },
    ];
  }

  private buildAmbient(): void {
    const { width, height } = BAL.view;
    // Warm overlay: coming home is literally a change of temperature on screen.
    this.add
      .rectangle(0, 0, width, height, hex(PAL.orange))
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0.1)
      .setDepth(5000);

    // A broad firelight wash over the whole camp, so home reads warm at a glance.
    this.add
      .image(15 * TILE_SIZE, 12 * TILE_SIZE, FX.glowHuge)
      .setTint(hex(PAL.orange))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.1)
      .setScale(0.75)
      .setDepth(4999);
  }

  // --- interactions ------------------------------------------------------

  private warmUp(): void {
    this.player.heal(this.player.maxHp, 'fire');
    this.juice.floatText(this.player.cx, this.player.sprite.y - 24, 'WARM', PAL.gold);
    bus.emit('audio:play', { cue: 'warm' });
  }

  private notYet(message: string): void {
    this.juice.floatText(this.player.cx, this.player.sprite.y - 24, message, PAL.cream, 1);
  }

  private headOut(): void {
    const storm = state.day >= BAL.day.stormFromDay && Math.random() < BAL.day.stormChance;
    state.run = newRunState(Date.now() & 0xffffff, this.player.maxHp, storm);
    SaveSystem.save();
    bus.emit('day:started', { day: state.day });

    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World'));
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

    let nearest: Station | null = null;
    let nearestDist = Infinity;
    for (const s of this.stations) {
      const d = Phaser.Math.Distance.Between(this.player.cx, this.player.cy, s.x, s.y);
      if (d < s.radius && d < nearestDist) {
        nearest = s;
        nearestDist = d;
      }
    }

    if (nearest) {
      this.prompt
        .setText(nearest.label)
        .setPosition(Math.round(this.player.cx), Math.round(this.player.sprite.y) - 26)
        .setVisible(true);
      if (input.interactPressed) nearest.action();
    } else {
      this.prompt.setVisible(false);
    }
  }

  private cleanup(): void {
    this.subs.dispose();
    this.weather?.destroy();
    this.juice?.destroy();
    this.player?.destroy();
  }
}
