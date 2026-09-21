import Phaser from 'phaser';
import { BAL } from '../data/balance';
import { bus, Subscriptions } from '../core/EventBus';
import { state } from '../core/GameState';
import { InputSystem } from '../core/InputSystem';
import { Player } from '../entities/Player';
import { Juice } from '../systems/Juice';
import { Weather } from '../systems/Weather';
import { generateWorld, SOLID_PROPS, type WorldMapData } from '../systems/MapGen';
import { SOLID_TILES, TILESET_KEY, TILE_SIZE } from '../art/sprites/tiles';
import { SCENERY_KEYS } from '../art/sprites/scenery';
import { CAMP_KEYS } from '../art/sprites/camp';
import { hex, mix, PAL } from '../art/palette';
import { FONT } from '../art/PixelFont';
import { hud } from '../core/HudState';
import { Rng, hashString } from '../core/Rng';
import {
  AREAS,
  RETURN_ZONE,
  WORLD_SPAWN,
  areaAtTile,
  rectContains,
  type AreaDef,
} from '../data/areas';

const PROP_TEXTURE: Record<string, string> = {
  pine: SCENERY_KEYS.pine,
  pineSmall: SCENERY_KEYS.pineSmall,
  deadTree: SCENERY_KEYS.deadTree,
  rock: SCENERY_KEYS.rock,
  rockSmall: SCENERY_KEYS.rockSmall,
  wreck: SCENERY_KEYS.wreck,
  crystal: SCENERY_KEYS.crystal,
  bush: SCENERY_KEYS.bush,
};

/** The expedition map. Phase 1 proves movement, the camera and the world read well. */
export class WorldScene extends Phaser.Scene {
  private input$!: InputSystem;
  private player!: Player;
  private juice!: Juice;
  private weather!: Weather;
  private subs = new Subscriptions();

  private mapData!: WorldMapData;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private ambient!: Phaser.GameObjects.Rectangle;
  private currentArea: AreaDef | null = null;
  private prompt!: Phaser.GameObjects.BitmapText;
  private ambientTarget: string = PAL.blue;
  private ambientCurrent: string = PAL.blue;

  constructor() {
    super('World');
  }

  create(): void {
    const seed = state.run?.seed ?? Date.now();
    this.mapData = generateWorld(seed);

    this.buildTilemap();
    this.buildHorizon();

    this.player = new Player(
      this,
      WORLD_SPAWN.x * TILE_SIZE + TILE_SIZE / 2,
      WORLD_SPAWN.y * TILE_SIZE + TILE_SIZE,
    );
    this.physics.add.collider(this.player.sprite, this.layer);

    this.buildProps();

    this.input$ = new InputSystem(this);
    this.juice = new Juice(this);
    this.weather = new Weather(this);

    this.buildAmbient();
    this.buildPrompt();
    this.setupCamera();

    if (!this.scene.isActive('HUD')) this.scene.launch('HUD');
    this.scene.bringToTop('HUD');

    this.events.once('shutdown', () => this.cleanup());
  }

  // --- world building ----------------------------------------------------

  private buildTilemap(): void {
    const map = this.make.tilemap({
      data: this.mapData.tiles,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = map.addTilesetImage('tiles', TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('[WorldScene] tileset could not be created');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('[WorldScene] tile layer could not be created');
    this.layer = layer;
    this.layer.setCollision(SOLID_TILES);
    this.layer.setDepth(0);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  /** A far ridge with the signal tower on it, so the goal is always on the horizon. */
  private buildHorizon(): void {
    const { width } = BAL.view;
    const ridge = this.add
      .rectangle(0, 0, width * 2, 40, hex(PAL.deep))
      .setOrigin(0)
      .setScrollFactor(0.08, 0.04)
      .setAlpha(0.55)
      .setDepth(-2);
    void ridge;

    const tower = this.add
      .image(width * 0.78, 40, SCENERY_KEYS.tower)
      .setOrigin(0.5, 1)
      .setScale(2)
      .setScrollFactor(0.08, 0.04)
      .setTint(hex(PAL.navy))
      .setDepth(-1);

    const blink = this.add
      .rectangle(tower.x, 22, 2, 2, hex(PAL.blood))
      .setScrollFactor(0.08, 0.04)
      .setDepth(-1);
    this.tweens.add({
      targets: blink,
      alpha: 0,
      duration: 340,
      yoyo: true,
      repeat: -1,
      repeatDelay: 1700,
    });
  }

  private buildProps(): void {
    const solids = this.physics.add.staticGroup();
    const rng = new Rng(hashString('props-render'));

    for (const prop of this.mapData.props) {
      const key = PROP_TEXTURE[prop.kind];
      if (!key) continue;
      const x = prop.tx * TILE_SIZE + TILE_SIZE / 2;
      const y = prop.ty * TILE_SIZE + TILE_SIZE;

      // A shadow on the snow. Nothing grounds a top-down world faster than this.
      const big = prop.kind === 'pine' || prop.kind === 'deadTree';
      const scale = big ? rng.range(1.45, 1.95) : rng.range(0.9, 1.3);
      const shadowW = Math.round(
        (prop.kind === 'wreck' ? 26 : prop.kind === 'bush' ? 12 : 15) * scale,
      );
      this.add
        .ellipse(x, y - 1, shadowW, Math.max(4, Math.round(shadowW * 0.32)), hex(PAL.blue))
        .setAlpha(0.3)
        .setDepth(y - 2);

      const img = this.add
        .image(x, y, key)
        .setOrigin(0.5, 1)
        .setDepth(y)
        .setScale(scale)
        .setFlipX(rng.chance(0.5));
      // A touch of colour drift so a forest is not a wall of clones. Kept small: the
      // greens are meant to stay saturated against the snow.
      if (prop.kind !== 'crystal') {
        img.setTint(hex(mix(PAL.white, rng.chance(0.5) ? PAL.cyan : PAL.cream, rng.range(0, 0.1))));
      }

      // Crystals glow, because the rarest thing in the world should be visible from far off.
      if (prop.kind === 'crystal') {
        const glow = this.add
          .image(x, y - 8, 'fx-glow-md')
          .setTint(hex(PAL.cyan))
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.35)
          .setDepth(y - 1);
        this.tweens.add({
          targets: glow,
          alpha: 0.6,
          duration: 1400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      if (SOLID_PROPS.includes(prop.kind)) {
        const w = prop.kind === 'wreck' ? 18 : prop.kind === 'crystal' ? 10 : 8;
        const blocker = solids.create(x, y - 3, 'fx-dot1') as Phaser.Physics.Arcade.Sprite;
        blocker.setVisible(false).setOrigin(0.5, 0.5);
        const body = blocker.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(w, 6);
        body.position.set(x - w / 2, y - 6);
        body.updateCenter();
      }
      void img;
    }

    this.physics.add.collider(this.player.sprite, solids);

    // Camp gate posts, drawn at the world's western edge so home is a landmark.
    for (const dy of [-3, 3]) {
      const px = (RETURN_ZONE.x1 + 1) * TILE_SIZE;
      const py = (WORLD_SPAWN.y + dy) * TILE_SIZE + TILE_SIZE;
      this.add.image(px, py, CAMP_KEYS.gatePost).setOrigin(0.5, 1).setDepth(py);
    }
  }

  private buildAmbient(): void {
    const { width, height } = BAL.view;
    // A light tint, not a dimmer. Multiply blending crushed the saturation out of
    // every tile, which is the opposite of what this world is supposed to look like.
    this.ambient = this.add
      .rectangle(0, 0, width, height, hex(PAL.blue))
      .setOrigin(0)
      .setScrollFactor(0)
      .setAlpha(0.09)
      .setDepth(5000);
  }

  private buildPrompt(): void {
    this.prompt = this.add
      .bitmapText(0, 0, FONT, '')
      .setOrigin(0.5, 1)
      .setTint(hex(PAL.gold))
      .setDepth(7500)
      .setVisible(false);
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.startFollow(this.player.sprite, true, BAL.camera.lerp, BAL.camera.lerp);
    cam.setDeadzone(BAL.camera.deadzone.w, BAL.camera.deadzone.h);
    cam.setBackgroundColor(PAL.navy);
    cam.followOffset.set(0, -6);
  }

  // --- loop --------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    const input = this.input$.update(this.player.cx, this.player.cy);
    this.player.update(dt, input);

    this.updateArea();
    this.updateInteraction(input.interactPressed);
    this.updateHud();
    this.weather.update(dt, this.currentArea?.id === 'lake' ? 0.5 : 0.18);

    // Ease the ambient tint between areas, so crossing a border changes the temperature
    // of the screen rather than snapping it.
    if (this.ambientCurrent !== this.ambientTarget) {
      this.ambientCurrent = mix(this.ambientCurrent, this.ambientTarget, 0.06);
      this.ambient.setFillStyle(hex(this.ambientCurrent), 1);
      if (this.ambientCurrent === this.ambientTarget) this.ambientCurrent = this.ambientTarget;
    }

    // Look a little way ahead of the player, which makes the camera feel intentional.
    const cam = this.cameras.main;
    cam.followOffset.set(
      Phaser.Math.Linear(cam.followOffset.x, -this.player.facingX * BAL.camera.lookAhead, 0.05),
      Phaser.Math.Linear(cam.followOffset.y, -6 - this.player.facingY * 6, 0.05),
    );
  }

  private updateHud(): void {
    hud.context = 'world';
    hud.hp = this.player.hp;
    hud.maxHp = this.player.maxHp;
    hud.day = state.day;
    hud.dashCharge = this.player.dashCharge;
    if (state.run) {
      hud.cold = state.run.cold;
      hud.carried = state.run.collected;
      hud.dayProgress = state.run.timeSec / BAL.day.length;
    }
  }

  private updateArea(): void {
    const tx = Math.floor(this.player.cx / TILE_SIZE);
    const ty = Math.floor(this.player.cy / TILE_SIZE);
    const area = areaAtTile(tx, ty);
    if (!area || area === this.currentArea) return;
    this.currentArea = area;
    this.ambientTarget = area.tint;

    if (!state.map.discoveredAreas.includes(area.id)) {
      state.map.discoveredAreas.push(area.id);
      state.run?.newAreas.push(area.id);
      bus.emit('area:discovered', { areaId: area.id });
      if (area.announce) this.announce(area.name);
    }
  }

  private announce(name: string): void {
    const { width, height } = BAL.view;
    const label = this.add
      .bitmapText(Math.round(width / 2), Math.round(height / 2) - 30, FONT, name.toUpperCase())
      .setOrigin(0.5)
      .setScale(2)
      .setTint(hex(PAL.white))
      .setScrollFactor(0)
      .setDepth(7600)
      .setAlpha(0);

    this.tweens.add({
      targets: label,
      alpha: 1,
      y: Math.round(height / 2) - 38,
      duration: 380,
      hold: 1500,
      yoyo: true,
      onComplete: () => label.destroy(),
    });
    bus.emit('audio:play', { cue: 'discover' });
  }

  private updateInteraction(pressed: boolean): void {
    const tx = Math.floor(this.player.cx / TILE_SIZE);
    const ty = Math.floor(this.player.cy / TILE_SIZE);
    const atGate = rectContains(RETURN_ZONE, tx, ty);

    if (atGate) {
      this.prompt
        .setText('E  RETURN TO CAMP')
        .setPosition(Math.round(this.player.cx), Math.round(this.player.sprite.y) - 26)
        .setVisible(true);
      if (pressed) this.returnToCamp();
    } else {
      this.prompt.setVisible(false);
    }
  }

  private returnToCamp(): void {
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Camp');
    });
  }

  private cleanup(): void {
    this.subs.dispose();
    this.weather?.destroy();
    this.juice?.destroy();
    this.player?.destroy();
  }
}

void AREAS;
